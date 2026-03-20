export default function Navbar(){
  return(
    <div className="nav">
      <div onClick={()=>location.href='/'}>首頁</div>
      <div onClick={()=>location.href='/dashboard'}>會員</div>
      <div onClick={()=>location.href='/deposit'}>儲值</div>
      <div onClick={()=>window.open('https://t.me/LA1111_bot')}>客服</div>
    </div>
  )
}
