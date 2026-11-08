import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import chatHandler from "./api/chat.js";
import adminHandler from "./api/admin.js";

const app=express();
const PORT=process.env.PORT||3000;
const __filename=fileURLToPath(import.meta.url);
const __dirname=path.dirname(__filename);

app.use(express.json({limit:"32kb"}));
app.get("/health",(req,res)=>res.status(200).json({status:"NIGHT HEX AI is running"}));
app.post("/api/chat",(req,res)=>chatHandler(req,res));
app.get("/api/admin",(req,res)=>adminHandler(req,res));

app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"admin.html")));
app.get("/admin.html",(req,res)=>res.redirect(301,"/admin"));
app.get("/style.css",(req,res)=>res.sendFile(path.join(__dirname,"style.css")));
app.get("/app.js",(req,res)=>res.sendFile(path.join(__dirname,"app.js")));
app.get("/admin.js",(req,res)=>res.sendFile(path.join(__dirname,"admin.js")));
app.use("/assets",express.static(path.join(__dirname,"assets"),{dotfiles:"deny",index:false}));
app.get("/",(req,res)=>res.sendFile(path.join(__dirname,"index.html")));
app.use((req,res)=>res.status(404).send("Page not found"));

app.listen(PORT,"0.0.0.0",()=>console.log(`NIGHT HEX AI running on port ${PORT}`));
