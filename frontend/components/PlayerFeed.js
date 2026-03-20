import {useState,useEffect} from "react";

const firstNames = [
  "阿明","小王","張哥","李姐","陳董","林Sir","黃大","周總","吳老闆","鄭姐",
  "趙哥","孫總","錢姐","王董","劉Sir","楊大","蔡總","許姐","謝哥","郭董",
  "Jason","Mike","David","Kevin","Alex","Tony","Jack","Leo","Sam","Eric",
  "Amy","Lisa","Jenny","Cathy","Linda","Nancy","Sandy","Vivian","Grace","Helen",
  "Player_88","Lucky_99","VIP_007","King_168","Boss_666","Star_520","Hero_888","Rich_999","Pro_168","Ace_777",
  "大贏家","幸運星","金手指","常勝軍","財神爺","小確幸","暴富哥","連勝王","穩贏姐","發財虎",
  "Diamond","Phoenix","Dragon","Tiger","Eagle","Wolf","Shark","Falcon","Panther","Cobra",
  "台北阿凱","高雄小李","台中老張","新竹阿偉","桃園小陳","台南大哥","嘉義阿姨","花蓮老王","宜蘭小妹","屏東阿伯",
  "Crypto_King","BTC_Boss","USDT_Pro","ETH_Master","Web3_God","DeFi_Lord","NFT_Queen","Whale_888","Hodl_King","Moon_Boy"
];

const actions = [
  {text:"剛儲值", amounts:["$500","$1,000","$2,000","$5,000","$10,000","$888","$1,688","$3,000"]},
  {text:"贏了", amounts:["$1,200","$3,500","$8,800","$15,000","$28,000","$6,666","$12,888","$50,000"]},
  {text:"連續贏", amounts:["3局","5局","7局","10局","12局"]},
  {text:"提款成功", amounts:["$2,000","$5,000","$10,000","$20,000","$8,888","$15,888"]},
  {text:"升級VIP", amounts:["銀卡","金卡","鑽石卡","至尊卡"]},
  {text:"獲得獎金", amounts:["$888","$1,688","$6,666","$8,888","$18,888"]},
  {text:"百家樂大贏", amounts:["$5,000","$12,000","$25,000","$38,000"]},
  {text:"老虎機爆獎", amounts:["$3,000","$8,000","$15,000","$30,000","$88,000"]},
];

const emojis = ["🔥","💰","🎉","🏆","💎","⭐","🚀","👑","💵","🎰"];

export default function PlayerFeed(){
  const [msg,setMsg]=useState("");

  useEffect(()=>{
    const update=()=>{
      const name = firstNames[Math.floor(Math.random()*firstNames.length)];
      const action = actions[Math.floor(Math.random()*actions.length)];
      const amount = action.amounts[Math.floor(Math.random()*action.amounts.length)];
      const emoji = emojis[Math.floor(Math.random()*emojis.length)];
      setMsg(`${emoji} ${name} ${action.text} ${amount}`);
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
