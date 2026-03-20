import {useState,useEffect} from "react";

const accounts = [
  "user_8832","user_4471","user_2209","user_6653","user_3318",
  "user_7741","user_9902","user_5564","user_1127","user_8845",
  "vip_1688","vip_5288","vip_8888","vip_3366","vip_6699",
  "vip_2288","vip_7788","vip_4488","vip_9988","vip_1188",
  "pro_9527","pro_3388","pro_6677","pro_1199","pro_8811",
  "pro_4422","pro_7733","pro_2266","pro_5599","pro_9944",
  "ace_1680","ace_5200","ace_8880","ace_3360","ace_6600",
  "ace_2280","ace_7700","ace_4400","ace_9900","ace_1100"
];

const actions = [
  {text:"儲值", amounts:["$500","$1,000","$2,000","$5,000","$888","$1,688","$3,000","$10,000"]},
  {text:"贏了", amounts:["$1,200","$3,500","$8,800","$6,666","$12,888","$28,000","$5,000","$15,000"]},
  {text:"提款成功", amounts:["$2,000","$5,000","$8,888","$10,000","$15,888","$20,000","$3,000","$6,000"]},
  {text:"連贏", amounts:["3局","5局","7局","10局","12局"]},
];

const emojis = ["🔥","💰","🎉","🏆","💎","⭐","🚀","👑"];

export default function PlayerFeed(){
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    const update=()=>{
      const acc = accounts[Math.floor(Math.random()*accounts.length)];
      const action = actions[Math.floor(Math.random()*actions.length)];
      const amount = action.amounts[Math.floor(Math.random()*action.amounts.length)];
      const emoji = emojis[Math.floor(Math.random()*emojis.length)];
      setMsg(`${emoji} ${acc} ${action.text} ${amount}`);
    };
    update();
    const timer = setInterval(update, 2500);
    return ()=>clearInterval(timer);
  },[]);

  return(
    <div style={{
      color:"#00ffcc",
      textAlign:"center",
      padding:"12px 20px",
      background:"rgba(0,255,204,0.05)",
      borderRadius:12,
      border:"1px solid rgba(0,255,204,0.15)",
      margin:"20px auto",
      maxWidth:500,
      fontSize:16,
      fontWeight:600,
      animation:"pulse 2s infinite"
    }}>
      {msg}
    </div>
  )
}
