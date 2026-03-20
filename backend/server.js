const express = require("express");
const cors = require("cors");
const sqlite3 = require("sqlite3").verbose();
const jwt = require("jsonwebtoken");
const axios = require("axios");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const db = new sqlite3.Database("./db.sqlite");

db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users(
    id INTEGER PRIMARY KEY,
    username TEXT,
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
  axios.get(`https://api.telegram.org/bot${process.env.TG_TOKEN}/sendMessage`,{
    params:{chat_id:process.env.TG_ID,text:msg}
  });
}

app.post("/register",(req,res)=>{
  db.run("INSERT INTO users(username,password) VALUES (?,?)",
  [req.body.username,req.body.password]);
  res.json({ok:true});
});

app.post("/login",(req,res)=>{
  db.get("SELECT * FROM users WHERE username=? AND password=?",
  [req.body.username,req.body.password],(e,u)=>{
    if(!u) return res.json({error:"fail"});
    res.json({token:jwt.sign({id:u.id},"secret")});
  });
});

app.post("/create-payment", async (req,res)=>{
  const {amount} = req.body;
  const user = auth(req);

  const pay = await axios.post("https://api.nowpayments.io/v1/payment",{
    price_amount: amount,
    price_currency:"usd",
    pay_currency:"usdttrc20"
  },{
    headers:{"x-api-key":process.env.PAY_KEY}
  });

  db.run(`INSERT INTO deposits(user_id,amount,status,payment_id)
  VALUES (?,?,?,?)`,
  [user.id,amount,"waiting",pay.data.payment_id]);

  res.json(pay.data);
});

app.post("/ipn",(req,res)=>{
  const hash = crypto.createHmac("sha512",process.env.IPN_SECRET)
  .update(JSON.stringify(req.body)).digest("hex");

  if(hash !== req.headers["x-nowpayments-sig"]) return res.send("bad");

  if(req.body.payment_status==="finished"){
    db.get(`SELECT * FROM deposits WHERE payment_id=?`,
    [req.body.payment_id],(e,row)=>{
      if(!row || row.status==="done") return;
      db.run(`UPDATE deposits SET status='done' WHERE id=?`,[row.id]);
      db.run(`UPDATE users SET balance = balance + ? WHERE id=?`,
      [row.amount,row.user_id]);
      sendTG("💰 收款成功");
    });
  }

  res.send("ok");
});

app.get("/me",(req,res)=>{
  const u = auth(req);
  db.get("SELECT * FROM users WHERE id=?",[u.id],(e,row)=>res.json(row));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
