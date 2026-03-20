require("dotenv").config();

const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const axios = require("axios");

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./db.sqlite");

db.serialize(()=>{
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY,
    username TEXT UNIQUE,
    password TEXT,
    balance REAL DEFAULT 0,
    level TEXT DEFAULT 'normal'
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS deposits(
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    amount REAL,
    status TEXT,
    payment_id TEXT,
    risk INTEGER DEFAULT 0
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS blacklist(
    id INTEGER PRIMARY KEY,
    type TEXT,
    value TEXT
  )`);
});

function auth(req){
  return jwt.verify(req.headers.authorization,"secret");
}

function sendTG(msg){
  if(process.env.TG_TOKEN && process.env.TG_ID){
    axios.get(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`,{
      params:{chat_id:process.env.TG_ID,text:msg}
    }).catch(()=>{});
  }
}

app.post("/register",(req,res)=>{
  db.run("INSERT INTO users(username,password) VALUES (?,?)",
  [req.body.username,req.body.password],(err)=>{
    if(err) return res.json({error:"用戶名已存在"});
    sendTG(`📝 新用戶註冊：${req.body.username}`);
    res.json({ok:true});
  });
});

app.post("/login",(req,res)=>{
  db.get("SELECT * FROM users WHERE username=? AND password=?",
  [req.body.username,req.body.password],(e,u)=>{
    if(!u) return res.json({error:"fail"});
    sendTG(`🔑 用戶登入：${u.username}`);
    res.json({token:jwt.sign({id:u.id},"secret")});
  });
});

app.get("/me",(req,res)=>{
  try{
    const u = auth(req);
    db.get("SELECT id,username,balance,level FROM users WHERE id=?",[u.id],(e,row)=>res.json(row||{}));
  }catch(e){
    res.json({error:"unauthorized"});
  }
});

app.post("/create-payment", async (req,res)=>{
  try{
    const u = auth(req);
    if(!process.env.PAY_KEY) return res.json({error:"儲值功能尚未啟用"});

    const pay = await axios.post("https://api.nowpayments.io/v1/payment",{
      price_amount:req.body.amount,
      price_currency:"usd",
      pay_currency:"usdttrc20"
    },{
      headers:{"x-api-key":process.env.PAY_KEY}
    });

    db.run(`INSERT INTO deposits(user_id,amount,status,payment_id) VALUES (?,?,?,?)`,
    [u.id,req.body.amount,"waiting",pay.data.payment_id]);

    sendTG(`💳 儲值請求：$${req.body.amount}`);
    res.json(pay.data);
  }catch(e){
    res.json({error:"payment failed"});
  }
});

app.post("/ipn",(req,res)=>{
  if(req.body.payment_status==="finished"){
    db.get("SELECT * FROM deposits WHERE payment_id=?",
    [req.body.payment_id],(e,row)=>{
      if(!row || row.status==="done") return;
      db.run("UPDATE deposits SET status='done' WHERE id=?",[row.id]);
      db.run("UPDATE users SET balance=balance+? WHERE id=?",[row.amount,row.user_id]);
      sendTG(`💰 收款成功：$${row.amount}`);
    });
  }
  res.send("ok");
});

// ===== CRM LEADS =====
app.get("/leads",(req,res)=>{
  db.all("SELECT * FROM leads ORDER BY created_at DESC",(e,rows)=>res.json(rows||[]));
});

app.put("/leads/:id",(req,res)=>{
  db.run("UPDATE leads SET status=? WHERE id=?",[req.body.status,req.params.id]);
  res.json({ok:true});
});

// Health check
app.get("/",(req,res)=>res.json({status:"ok",service:"la1-backend"}));

const PORT = process.env.PORT || 3001;
app.listen(PORT, ()=> console.log(`LA1 Backend running on port ${PORT}`));
