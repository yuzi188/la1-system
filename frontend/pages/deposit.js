import {useState} from "react";
import Navbar from "../components/Navbar";

export default function Deposit(){
const [amount,setAmount]=useState(100);

const pay=async()=>{
  const token = localStorage.getItem("token");
  if(!token) { location.href="/login"; return; }
  const res = await fetch(process.env.NEXT_PUBLIC_API+"/create-payment",{
    method:"POST",
    headers:{"Content-Type":"application/json",Authorization:token},
    body:JSON.stringify({amount})
  });
  const data = await res.json();
  if(data.invoice_url) window.open(data.invoice_url);
  else alert("儲值功能尚未啟用");
}

return(
<div>
<Navbar/>
<div style={{maxWidth:400,margin:"80px auto",textAlign:"center"}}>
<h2>💰 儲值</h2>
<div style={{display:"flex",gap:10,justifyContent:"center",margin:20}}>
{[50,100,200,500].map(a=>(
  <button key={a} onClick={()=>setAmount(a)}
  style={{padding:"10px 20px",background:amount===a?"#7c3aed":"#1a1a1a",border:"1px solid #333",borderRadius:8,color:"#fff",cursor:"pointer"}}>
  ${a}
  </button>
))}
</div>
<button className="btn" onClick={pay}>確認儲值 ${amount}</button>
</div>
</div>
)
}
