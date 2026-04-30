const path = require("path");
const express = require("express");
const session = require("cookie-session");
const dotenv = require("dotenv");
const { getStudentSchedule, getStudentTermSchedule, getStudentExamSchedule } = require("./services/eautClient");

dotenv.config();

const app = express();
app.set("trust proxy", 1);
const port = process.env.PORT || 5000;

app.set("view engine", "ejs");
app.set("views", path.join(process.cwd(), "views"));
app.use(express.static(path.join(process.cwd(), "public")));
app.use(express.urlencoded({ extended: false }));
app.use(
  session({
    name: "session",
    keys: [process.env.SESSION_SECRET || "eaut_secret_key_2024"],
    maxAge: 24 * 60 * 60 * 1000,
  })
);

app.use((req, res, next) => {
  res.header("Cache-Control", "no-cache, no-store, must-revalidate");
  res.header("Pragma", "no-cache");
  res.header("Expires", "0");
  next();
});

app.get("/", (req, res) => {
  const saved = req.session.studentLogin;
  if (saved?.username) return res.redirect("/schedule/week");
  res.render("index", {
    error: null,
    result: null,
    formData: { username: "", password: "" },
    studentName: null,
    activeTab: "login"
  });
});

app.post("/schedule", async (req, res) => {
  const formData = { username: req.body.username || "", password: req.body.password || "" };
  try {
    const result = await getStudentSchedule(formData.username, formData.password, { useCache: true });
    req.session.studentLogin = { username: formData.username, password: formData.password, studentName: result.studentName };
    
    // Background pre-fetch for extra speed
    getStudentTermSchedule(formData.username, formData.password, { useCache: true, fetchAll: true }).catch(() => {});
    getStudentExamSchedule(formData.username, formData.password, { useCache: true, fetchAll: true }).catch(() => {});

    res.redirect("/schedule/week");
  } catch (error) {
    res.render("index", { 
      error: error.message, result: null, formData, studentName: null, activeTab: "login" 
    });
  }
});

app.get("/schedule/week", async (req, res) => {
  const saved = req.session.studentLogin;
  if (!saved) return res.redirect("/");
  try {
    const result = await getStudentSchedule(saved.username, saved.password, { preferredWeek: req.query.week || "", useCache: true });
    res.render("index", { result, activeTab: "week", studentName: saved.studentName, formData: { username: saved.username } });
  } catch (error) {
    res.redirect("/");
  }
});

app.get("/schedule/term", async (req, res) => {
  const saved = req.session.studentLogin;
  if (!saved) return res.redirect("/");
  try {
    const result = await getStudentTermSchedule(saved.username, saved.password, { useCache: true, fetchAll: true });
    res.render("index", { result, activeTab: "term", studentName: saved.studentName, formData: { username: saved.username } });
  } catch (error) {
    res.redirect("/");
  }
});

app.get("/schedule/exam", async (req, res) => {
  const saved = req.session.studentLogin;
  if (!saved) return res.redirect("/");
  try {
    const result = await getStudentExamSchedule(saved.username, saved.password, { useCache: true, fetchAll: true });
    res.render("index", { result, activeTab: "exam", studentName: saved.studentName, formData: { username: saved.username } });
  } catch (error) {
    res.redirect("/");
  }
});

app.get("/logout", (req, res) => {
  req.session = null;
  res.redirect("/");
});

if (process.env.NODE_ENV !== "production") {
  app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
}
module.exports = app;