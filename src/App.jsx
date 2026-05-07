export default function App() {
  return (
    <div style={{
      minHeight:'100vh',
      background:'#04122d',
      color:'#fff',
      display:'flex',
      alignItems:'center',
      justifyContent:'center',
      fontFamily:'Rubik,sans-serif'
    }}>
      <div style={{
        padding:'40px',
        borderRadius:'30px',
        background:'rgba(7,22,52,.7)',
        border:'1px solid rgba(77,163,255,.14)',
        backdropFilter:'blur(20px)'
      }}>
        <h1>INVEST Executive</h1>
        <p>האפליקציה מוכנה ומחוברת ל‑Supabase</p>
      </div>
    </div>
  )
}
