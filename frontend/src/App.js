import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Link, useNavigate, useParams, useLocation } from "react-router-dom";
import axios from "axios";
import { FilePlus2, ArrowLeft, Printer, Share2, Download, ChevronDown, Trash2, Plus, FileSpreadsheet, Undo2, Copy, CheckCircle2, RotateCcw, AlertTriangle, MessageCircle, User, History as HistoryIcon } from "lucide-react";
import "@/App.css";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const rupiah = (n) => `Rp ${new Intl.NumberFormat("id-ID").format(Number(n || 0))}`;
const fmt = (n) => new Intl.NumberFormat("id-ID").format(Number(n || 0));
const cleanMoney = (v) => Number(String(v || 0).replace(/Rp|\s|\./g, "").replace(",", "")) || 0;
const parseRows = (text, type) => text.trim().split(/\n/).filter(Boolean).map((r) => r.split(/[\t;,]/).map((x) => x.trim())).map((c) => type === "delivery" ? ({ sku:c[0]||"", name:c[1]||"", unit:c[2]||"karton", quantity:Number(c[3]||0), damaged:Number(c[4]||0) }) : ({ sku:c[0]||"", name:c[1]||"", unit:c[2]||"karton", quantity:Number(c[3]||0), unit_price:cleanMoney(c[4]) }));
const emptyRow = (t) => t === "delivery" ? { sku:"", name:"", unit:"karton", quantity:0, damaged:0 } : { sku:"", name:"", unit:"karton", quantity:0, unit_price:0 };
const rowError = (r, t) => !r.sku ? "SKU kosong. Isi kolom SKU untuk melanjutkan." : !r.name ? "Nama barang kosong." : r.quantity <= 0 ? "Jumlah harus lebih dari nol." : (t !== "delivery" && r.unit_price <= 0) ? "Harga satuan belum dibaca. Periksa format angka." : "";
const template = (t) => t === "delivery" ? "SKU\tNama barang\tSatuan\tJumlah diterima\tJumlah rusak" : "SKU\tNama barang\tSatuan\tJumlah\tHarga satuan";
const getActor = () => localStorage.getItem("selisih_actor") || "";
const getThreshold = () => Number(localStorage.getItem("selisih_threshold")) || 10000000;
const OVERDUE_DAYS = 14;
const relTime = (iso) => { if(!iso) return ""; const d=new Date(iso); const m=Math.floor((Date.now()-d.getTime())/60000); if(m<1) return "baru saja"; if(m<60) return `${m} menit lalu`; if(m<1440) return `${Math.floor(m/60)} jam lalu`; return `${Math.floor(m/1440)} hari lalu`; };
function terbilang(n){const a=["","satu","dua","tiga","empat","lima","enam","tujuh","delapan","sembilan","sepuluh","sebelas"];n=Number(n);if(n<12)return a[n];if(n<20)return terbilang(n-10)+" belas";if(n<100)return terbilang(Math.floor(n/10))+" puluh "+terbilang(n%10);if(n<200)return "seratus "+terbilang(n-100);if(n<1000)return terbilang(Math.floor(n/100))+" ratus "+terbilang(n%100);if(n<2000)return "seribu "+terbilang(n-1000);if(n<1000000)return terbilang(Math.floor(n/1000))+" ribu "+terbilang(n%1000);if(n<1000000000)return terbilang(Math.floor(n/1000000))+" juta "+terbilang(n%1000000);return terbilang(Math.floor(n/1000000000))+" miliar "+terbilang(n%1000000000)}

function LogoMark(){ return <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true"><rect x="1.5" y="1.5" width="15" height="19" fill="#fff" stroke="#14161C" strokeWidth="1.2"/><rect x="4.5" y="3.5" width="15" height="19" fill="#F4E4A2" stroke="#14161C" strokeWidth="1.2"/><rect x="7.5" y="5.5" width="15" height="19" fill="#F3C7CE" stroke="#14161C" strokeWidth="1.2"/><path d="M10.5 12h9M10.5 15h9M10.5 18h5" stroke="#14161C" strokeWidth="1.1" opacity=".55"/></svg>; }

function SettingsPanel({ onClose }) {
  const [actor, setActor] = useState(getActor()); const [threshold, setThreshold] = useState(getThreshold());
  const save = () => { localStorage.setItem("selisih_actor", actor.trim()); localStorage.setItem("selisih_threshold", String(threshold||0)); onClose(true); };
  return <div className="settings-mask" onClick={()=>onClose(false)}><div className="settings-panel" onClick={e=>e.stopPropagation()} data-testid="settings-panel">
    <h2>Preferensi</h2>
    <label>Nama Anda<small>Muncul di riwayat perubahan sebagai pembuat aksi.</small><input value={actor} onChange={e=>setActor(e.target.value)} placeholder="Contoh: Budi Finance" data-testid="settings-actor-input"/></label>
    <label>Ambang selisih besar (Rp)<small>Nota di atas nilai ini ditandai kritis di dashboard.</small><input type="number" value={threshold} onChange={e=>setThreshold(Number(e.target.value)||0)} data-testid="settings-threshold-input"/></label>
    <div className="settings-actions"><button className="btn line sm" onClick={()=>onClose(false)} data-testid="settings-cancel">Batalkan</button><button className="btn sm" onClick={save} data-testid="settings-save">Simpan preferensi</button></div>
  </div></div>;
}

function Layout({ children, tag="Cocokkan PO, surat jalan, dan faktur. Temukan uangnya." }) {
  const [show, setShow] = useState(false); const [actor, setActor] = useState(getActor());
  useEffect(()=>{ if(!actor) setShow(true); }, [actor]);
  return <div className="wrap"><header className="bar"><Link to="/" className="mark" data-testid="app-logo"><LogoMark/><b>SELISIH</b></Link><div className="bar-tag">{tag}</div><div className="bar-actions"><button className="ghost-btn" onClick={()=>setShow(true)} data-testid="open-settings-button" title="Preferensi"><User size={13}/> {actor || "Atur identitas"}</button><Link to="/baru" className="btn sm" data-testid="new-reconciliation-header-button"><FilePlus2 size={14}/> Rekonsiliasi baru</Link></div></header>{show&&<SettingsPanel onClose={(s)=>{setShow(false); if(s) setActor(getActor());}}/>}{children}</div>;
}

function HeroArt(){
  return <svg className="art" viewBox="0 0 500 430" role="img" aria-label="Tiga rangkap dokumen dengan cap selisih">
    <defs>
      <filter id="kasar"><feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves="3" seed="9" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="3.4"/></filter>
      <filter id="bercak"><feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="2" seed="4" result="t"/><feColorMatrix in="t" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.5 1.05" result="m"/><feComposite in="SourceGraphic" in2="m" operator="in"/></filter>
    </defs>
    <g transform="rotate(6 250 220) translate(96 96)"><rect width="272" height="316" fill="#F3C7CE" stroke="#14161C" strokeWidth="1.6"/><text x="18" y="30" fontFamily="Archivo,sans-serif" fontSize="12" fontWeight="700" letterSpacing="2.6" fill="#14161C">FAKTUR</text><path d="M18 44h236" stroke="#14161C" strokeWidth="1.2" opacity=".5"/><g opacity=".3"><path d="M18 74h150M18 96h190M18 118h120M18 140h176M18 162h140M18 184h198M18 206h108M18 228h164" stroke="#14161C" strokeWidth="2.4" strokeLinecap="round"/></g><path d="M170 262h84" stroke="#14161C" strokeWidth="1.6" opacity=".55"/><path d="M170 276h84" stroke="#14161C" strokeWidth="3" opacity=".8"/></g>
    <g transform="rotate(-2 250 210) translate(60 62)"><rect width="272" height="316" fill="#F4E4A2" stroke="#14161C" strokeWidth="1.6"/><text x="18" y="30" fontFamily="Archivo,sans-serif" fontSize="12" fontWeight="700" letterSpacing="2.6" fill="#14161C">SURAT JALAN</text><path d="M18 44h236" stroke="#14161C" strokeWidth="1.2" opacity=".5"/><g opacity=".3"><path d="M18 74h170M18 96h132M18 118h188M18 140h146M18 162h176M18 184h116M18 206h192M18 228h150" stroke="#14161C" strokeWidth="2.4" strokeLinecap="round"/></g><path d="M196 156l26 0" stroke="#C0272D" strokeWidth="2.2" opacity=".85"/><text x="196" y="150" fontFamily="IBM Plex Mono,monospace" fontSize="15" fontWeight="600" fill="#C0272D">88</text><path d="M18 262h100" stroke="#14161C" strokeWidth="1.6" opacity=".5"/><path d="M18 276h132" stroke="#14161C" strokeWidth="3" opacity=".75"/></g>
    <g transform="rotate(-9 250 200) translate(26 30)"><rect width="272" height="316" fill="#FFFFFF" stroke="#14161C" strokeWidth="1.6"/><text x="18" y="30" fontFamily="Archivo,sans-serif" fontSize="12" fontWeight="700" letterSpacing="2.6" fill="#14161C">PURCHASE ORDER</text><path d="M18 44h236" stroke="#14161C" strokeWidth="1.2" opacity=".55"/><text x="18" y="72" fontFamily="IBM Plex Mono,monospace" fontSize="11" fill="#14161C" opacity=".8">MGR-2L-012</text><text x="18" y="90" fontFamily="Instrument Sans,sans-serif" fontSize="12" fontWeight="600" fill="#14161C">Minyak Goreng 2L</text><text x="18" y="112" fontFamily="IBM Plex Mono,monospace" fontSize="15" fontWeight="600" fill="#14161C">100 karton</text><text x="150" y="112" fontFamily="IBM Plex Mono,monospace" fontSize="15" fontWeight="600" fill="#14161C">240.000</text><path d="M18 126h236" stroke="#14161C" strokeWidth="1" opacity=".35"/><g opacity=".26"><path d="M18 150h188M18 172h140M18 194h176M18 216h122M18 238h182" stroke="#14161C" strokeWidth="2.4" strokeLinecap="round"/></g><path d="M18 268h96" stroke="#14161C" strokeWidth="1.6" opacity=".5"/><path d="M18 282h124" stroke="#14161C" strokeWidth="3" opacity=".75"/><g fill="#EFEEE7" stroke="#14161C" strokeWidth=".9" opacity=".7"><circle cx="272" cy="70" r="4"/><circle cx="272" cy="158" r="4"/><circle cx="272" cy="246" r="4"/></g></g>
    <g id="capStamp" transform="translate(318 322) rotate(-11)"><g filter="url(#kasar)"><g filter="url(#bercak)"><rect x="-116" y="-38" width="232" height="76" fill="none" stroke="#C0272D" strokeWidth="4"/><rect x="-108" y="-30" width="216" height="60" fill="none" stroke="#C0272D" strokeWidth="1.6"/><text x="0" y="-8" textAnchor="middle" fontFamily="Archivo,sans-serif" fontSize="12" fontWeight="800" letterSpacing="3.4" fill="#C0272D">TAGIH LEBIH</text><text x="0" y="18" textAnchor="middle" fontFamily="IBM Plex Mono,monospace" fontSize="21" fontWeight="700" fill="#C0272D">Rp 2.880.000</text></g></g></g>
  </svg>;
}

function useAnimateOnMount(deps) {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      document.querySelectorAll('.anim').forEach(n => n.classList.add('in'));
      const s = document.getElementById('capStamp'); if(s) s.classList.add('cap');
      return;
    }
    setTimeout(()=>{ const s = document.getElementById('capStamp'); if(s) s.classList.add('cap'); }, 620);
    document.querySelectorAll('.anim').forEach((n, i) => setTimeout(()=>n.classList.add('in'), 140 + i * 40));
  }, deps);
}

function CountUp({ target, className }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setN(target); return; }
    let start = null; const dur = 700;
    const step = (t) => { if(start===null) start=t; const p = Math.min((t-start)/dur, 1); const e = 1 - Math.pow(1-p,3); setN(Math.round(target*e)); if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }, [target]);
  return <span className={className}>{fmt(n)}</span>;
}

function ProductBlok({ p, className="" }) {
  const badPO = p.issues.some(x=>x.type==="HARGA TIDAK SESUAI");
  const badSJ = p.issues.some(x=>["KURANG KIRIM","BARANG RUSAK"].includes(x.type)) || p.delivery?.damaged>0;
  const badFK = p.issues.some(x=>x.type.includes("TAGIH")||x.type.includes("HARGA"));
  const bermasalah = p.issues.length>0 && p.impact>0;
  const jenis = p.issues.filter(x=>x.value).map(x=>x.type)[0] || (p.issues[0]?.type) || "Cocok";
  const impactMerah = p.impact>0;
  const desc = (() => {
    const parts = [];
    if(p.issues.some(x=>x.type==="KURANG KIRIM")) parts.push(`Diterima ${p.delivery?.quantity||0} dari ${p.po?.quantity||0} karton`);
    if(p.issues.some(x=>x.type==="TAGIH LEBIH")) parts.push(`Ditagih ${p.invoice?.quantity||0} karton`);
    if(p.issues.some(x=>x.type==="BARANG RUSAK")) parts.push(`${p.delivery?.damaged||0} karton rusak`);
    if(p.issues.some(x=>x.type==="HARGA TIDAK SESUAI")) parts.push(`Harga faktur Rp ${fmt(Math.abs((p.invoice?.unit_price||0)-(p.po?.unit_price||0)))} berbeda dari PO`);
    if(!parts.length) parts.push("Ketiga dokumen sama. Tidak ada tindakan.");
    return parts.join(". ") + ".";
  })();
  const nilaiPO = (p.po?.quantity||0)*(p.po?.unit_price||0);
  const nilaiSJ = (p.delivery?.quantity||0)*(p.po?.unit_price||0);
  const nilaiFK = (p.invoice?.quantity||0)*(p.invoice?.unit_price||0);
  return <article className={`blok ${bermasalah?"bermasalah":""} anim ${className}`} data-testid={`comparison-product-${p.sku}`}>
    <div className="blok-atas"><span className="sku">{p.sku}</span><span className="nama">{p.name}</span><span className="satuan">{p.unit}</span></div>
    <div className="baris">
      <div className="salin s-po">Pesanan</div>
      <div className="sel"><small>Jumlah</small>{fmt(p.po?.quantity)}</div>
      <div className={`sel ${badPO?"":""}`}><small>Harga satuan</small>{fmt(p.po?.unit_price)}</div>
      <div className="sel"><small>Nilai</small>{fmt(nilaiPO)}</div>
      <div className="dampak" style={{gridRow:"1 / span 3"}}><div className={`jenis ${impactMerah?"merah":"hijau"}`}>{jenis}</div><div className={`nilai ${impactMerah?"merah":"hijau"}`}>{rupiah(p.impact)}</div></div>
    </div>
    <div className="baris">
      <div className="salin s-sj">Surat jalan</div>
      <div className={`sel ${badSJ?"merah":""}`}><small>Diterima</small>{fmt(p.delivery?.quantity)}</div>
      <div className={`sel ${p.delivery?.damaged?"merah":""}`}><small>Rusak</small>{fmt(p.delivery?.damaged)}</div>
      <div className="sel"><small>Nilai diterima</small>{fmt(nilaiSJ)}</div>
    </div>
    <div className="baris">
      <div className="salin s-fak">Faktur</div>
      <div className={`sel ${p.issues.some(x=>x.type.includes("TAGIH"))?"merah":""}`}><small>Ditagih</small>{fmt(p.invoice?.quantity)}</div>
      <div className={`sel ${badPO?"merah":""}`}><small>Harga satuan</small>{fmt(p.invoice?.unit_price)}</div>
      <div className="sel"><small>Nilai</small>{fmt(nilaiFK)}</div>
    </div>
    <div className="blok-bawah"><span>{desc}</span><span className="mono">{p.impact>0 ? `${p.issues[0]?.type==="HARGA TIDAK SESUAI"?fmt(Math.abs((p.invoice?.unit_price||0)-(p.po?.unit_price||0)))+" × "+fmt(p.invoice?.quantity):(fmt(Math.abs((p.po?.quantity||0)-(p.delivery?.quantity||0)))+" × "+fmt(p.po?.unit_price||p.invoice?.unit_price))}` : "—"}</span></div>
  </article>;
}

function TrendChart({ weeks }) {
  if(!weeks?.length) return null;
  const max = Math.max(1, ...weeks.map(w=>w.total));
  return <section className="trend" data-testid="trend-widget">
    <div className="head" style={{margin:"0 0 6px"}}><h2>TREN SELISIH MINGGUAN</h2><div className="note">8 minggu terakhir</div></div>
    <div className="trend-bars">{weeks.map((w,i)=>{const h=Math.max(3,Math.round((w.total/max)*100)); return <div className="trend-col" key={w.week_start} data-testid={`trend-week-${i}`}><div className="trend-val">{w.total?rupiah(w.total):""}</div><div className="trend-bar" style={{height:`${h}%`}} data-hi={i===weeks.length-1?"true":undefined}/><div className="trend-lbl">{w.label}</div></div>;})}</div>
  </section>;
}

function Dashboard() {
  const [data, setData] = useState({items:[], total_found:0, supplier_ledger:[], supplier_options:[], monthly:null, weekly_trend:[]});
  const [supplier, setSupplier] = useState(""); const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [statusFilter, setStatusFilter] = useState("all");
  const [undo, setUndo] = useState(null); const [selected, setSelected] = useState([]); const [expanded, setExpanded] = useState(null);
  const [latest, setLatest] = useState(null);
  const threshold = getThreshold(); const actor = getActor();
  const query = () => { const p = new URLSearchParams(); if(supplier)p.set("supplier",supplier); if(start)p.set("start",start); if(end)p.set("end",end); if(statusFilter && statusFilter!=="all" && statusFilter!=="overdue") p.set("status",statusFilter); return p.toString(); };
  const load = () => axios.get(`${API}/reconciliations?${query()}`).then(async r=>{
    setData(r.data); setSelected([]);
    const cand = r.data.items.find(i=>i.status!=="paid" && i.total_discrepancy>0) || r.data.items[0];
    if(cand){ const full = await axios.get(`${API}/reconciliations/${cand.id}`); setLatest(full.data); } else setLatest(null);
  }).catch(()=>{});
  useEffect(() => { load(); }, [supplier, start, end, statusFilter]);
  useEffect(() => { if(!undo) return; const t = setTimeout(()=>setUndo(null), 8000); return () => clearTimeout(t); }, [undo]);
  useAnimateOnMount([data.items.length, latest?.id]);
  const remove = async (id, ref, e) => { e.preventDefault(); e.stopPropagation(); await axios.delete(`${API}/reconciliations/${id}`); setUndo({ids:[id], ref}); load(); };
  const restore = async () => { if(!undo) return; await Promise.all(undo.ids.map(i=>axios.post(`${API}/reconciliations/${i}/restore`))); setUndo(null); load(); };
  const reset = () => { setSupplier(""); setStart(""); setEnd(""); setStatusFilter("all"); };
  const toggle = (id) => setSelected(sel => sel.includes(id) ? sel.filter(x=>x!==id) : [...sel, id]);
  const bulk = async (action) => { if(!selected.length) return; await axios.post(`${API}/reconciliations/bulk`, {ids:selected, action, actor}); if(action==="delete") setUndo({ids:selected, ref:`${selected.length} rekonsiliasi`}); load(); };
  const remindWA = (item, e) => { e.preventDefault(); e.stopPropagation(); const link=`${window.location.origin}/bagikan/${item.share_token}`; const msg=`Halo ${item.supplier_name}, mohon konfirmasi nota retur ${item.reference} sebesar ${rupiah(item.total_discrepancy)} yang sudah terbuka ${item.days_open} hari. Detail: ${link}`; window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, "_blank"); };
  const m = data.monthly; const delta = m ? (m.current_month - m.previous_month) : 0;
  const displayed = statusFilter==="overdue" ? data.items.filter(i=>i.status!=="paid"&&(i.days_open||0)>=OVERDUE_DAYS) : data.items;
  const overdue = data.items.filter(i => i.status !== "paid" && i.days_open >= OVERDUE_DAYS && i.total_discrepancy > 0);
  const nBaris = data.items.reduce((a,b)=>a+(b.baris_ct||0),0);

  return <Layout>
    <section className="hero"><div>
      <div className="eyebrow">Total selisih ditemukan</div>
      <div className="total" data-testid="total-discrepancy"><span className="rp">Rp</span><CountUp target={data.total_found}/></div>
      <p className="kicker">Uang yang sudah Anda bayar untuk barang yang tidak pernah sampai.</p>
      <p style={{marginTop:-8}}>Tiga dokumen, satu tombol. SELISIH membandingkan pesanan, kiriman, dan tagihan baris per baris — lalu membuat nota returnya.</p>
    </div><HeroArt/></section>

    <dl className="strip">
      <div className="fact"><dt>Rekonsiliasi</dt><dd>{fmt(data.items.length)}</dd></div>
      <div className="fact"><dt>Pemasok aktif</dt><dd>{fmt(data.supplier_options.length)}</dd></div>
      <div className="fact"><dt>Terlambat &gt; 14 hari</dt><dd>{fmt(overdue.length)}</dd></div>
      <div className="fact"><dt>Sudah dibayar</dt><dd>{fmt(data.items.filter(i=>i.status==="paid").length)}</dd></div>
    </dl>

    <TrendChart weeks={data.weekly_trend}/>

    {m && <dl className="monthly" data-testid="monthly-summary">
      <div className="mon-cell"><dt>{m.current_label}</dt><dd className={m.current_month?"bad":"clean"}>{rupiah(m.current_month)}</dd><small>{m.current_count} rekonsiliasi</small></div>
      <div className="mon-cell"><dt>{m.previous_label}</dt><dd>{rupiah(m.previous_month)}</dd><small>{m.previous_count} rekonsiliasi</small></div>
      <div className="mon-cell"><dt>Bulan ini vs lalu</dt><dd className={delta>0?"bad":delta<0?"clean":""}>{delta>0?"+":""}{rupiah(delta)}</dd><small>{delta>0?"lebih tinggi dari bulan lalu":delta<0?"turun dari bulan lalu":"sama seperti bulan lalu"}</small></div>
    </dl>}

    {overdue.length>0&&<section className="overdue" data-testid="overdue-panel">
      <div className="overdue-head"><AlertTriangle size={16}/> <b>{overdue.length} rekonsiliasi terbuka lebih dari {OVERDUE_DAYS} hari</b><small>Kirim pengingat ke pemasok agar tidak menunggak lebih lama.</small></div>
      {overdue.map(item=><div className="overdue-row" key={item.id} data-testid={`overdue-row-${item.reference}`}><span className="mono">{item.reference}</span><span><b>{item.supplier_name}</b> · <span className="mono">{item.days_open} hari</span></span><span className="mono bad" style={{textAlign:"right",fontWeight:700}}>{rupiah(item.total_discrepancy)}</span><button className="btn line sm" onClick={(e)=>remindWA(item,e)} data-testid={`overdue-remind-${item.reference}`}><MessageCircle size={13}/> Ingatkan via WhatsApp</button></div>)}
    </section>}

    <div className="head" style={{marginBottom:8}}><h2>FILTER &amp; EKSPOR</h2></div>
    <section className="filter" data-testid="filter-bar">
      <label className="field">Pemasok<select value={supplier} onChange={e=>setSupplier(e.target.value)} data-testid="filter-supplier"><option value="">Semua pemasok</option>{data.supplier_options?.map(s=><option key={s} value={s}>{s}</option>)}</select></label>
      <label className="field">Dari tanggal<input type="date" value={start} onChange={e=>setStart(e.target.value)} data-testid="filter-start"/></label>
      <label className="field">Sampai tanggal<input type="date" value={end} onChange={e=>setEnd(e.target.value)} data-testid="filter-end"/></label>
      <div className="chips" role="tablist" aria-label="Filter status"><span className="chips-label">Status</span>{[["all","Semua"],["open","Terbuka"],["paid","Sudah dibayar"],["overdue","Terlambat"]].map(([v,l])=><button key={v} className={`chip ${statusFilter===v?"active":""}`} onClick={()=>setStatusFilter(v)} data-testid={`filter-status-${v}`}>{l}</button>)}</div>
      {(supplier||start||end||statusFilter!=="all")&&<button className="reset" onClick={reset} data-testid="filter-reset">Hapus filter</button>}
      <div className="filter-tools">
        <a className="btn line sm" href={`${API}/summary.xlsx?${query()}`} data-testid="export-summary-button"><FileSpreadsheet size={13}/> Ekspor XLSX</a>
        <Link className="btn line sm" to="/rekap" data-testid="rekap-button"><Printer size={13}/> Rekap PDF bulanan</Link>
      </div>
    </section>

    {data.supplier_ledger?.length>0&&<>
      <div className="head"><h2>BUKU BESAR PEMASOK</h2><div className="note">{data.supplier_ledger.length} pemasok</div></div>
      <div className="ledger">{data.supplier_ledger.map((s)=><button className="led-row" key={s.supplier_name} onClick={()=>setExpanded(expanded===s.supplier_name?null:s.supplier_name)} data-testid={`supplier-ledger-${s.supplier_name}`}><span className="led-name"><b>{s.supplier_name}</b><small>{s.reconciliation_count} rekonsiliasi</small></span><span className={`angka ${s.total_discrepancy?"merah":"netral"}`}>{rupiah(s.total_discrepancy)}</span><ChevronDown size={16} style={{color:"var(--muted)"}}/>{expanded===s.supplier_name&&<span className="led-detail">{data.items.filter(i=>i.supplier_name===s.supplier_name).map(i=><Link className="led-child" to={`/rekonsiliasi/${i.id}`} key={i.id}><span className="mono">{i.reference}</span><span className={`angka ${i.total_discrepancy?"merah":"netral"}`}>{rupiah(i.total_discrepancy)}</span></Link>)}</span>}</button>)}</div>
    </>}

    {latest && latest.products?.length>0 && <>
      <div className="head"><h2>REKONSILIASI TERAKHIR · {latest.supplier_name.toUpperCase()}</h2><div className="note">{latest.reference} · {Math.min(3, latest.products.length)} dari {latest.products.length} baris</div></div>
      <div className="sheet">{latest.products.slice(0,3).map((p)=><ProductBlok key={p.sku} p={p}/>)}</div>
      <div className="actions"><Link className="btn" to={`/nota/${latest.id}`} data-testid="hero-create-return">Buat nota retur</Link><Link className="btn line" to={`/rekonsiliasi/${latest.id}`} data-testid="hero-open-comparison">Lihat perbandingan lengkap</Link></div>
    </>}

    <div className="head"><h2>SEMUA REKONSILIASI</h2><div className="note">{displayed.length} dokumen{statusFilter!=="all"?` · filter ${statusFilter}`:" · urut terbaru"}</div></div>
    <div className="daftar">
      {!displayed.length ? <div className="empty" data-testid="empty-reconciliation-state">{supplier||start||end||statusFilter!=="all"?"Tidak ada rekonsiliasi cocok dengan filter. Sesuaikan pilihan atau hapus filter.":"Belum ada rekonsiliasi. Mulai dengan memasukkan PO pertama Anda."}</div>
      : displayed.map((item)=>{const critical = item.status!=="paid" && item.total_discrepancy >= threshold; const isOverdue = item.days_open>=OVERDUE_DAYS && item.status!=="paid"; return <Link className={`rek ${item.status==="paid"?"paid":""} ${selected.includes(item.id)?"selected":""} ${critical?"critical":""}`} to={`/rekonsiliasi/${item.id}`} key={item.id} data-testid={`reconciliation-row-${item.reference}`}>
        <span className="row-check" onClick={(e)=>{e.preventDefault();e.stopPropagation();}}><input type="checkbox" checked={selected.includes(item.id)} onChange={()=>toggle(item.id)} onClick={(e)=>e.stopPropagation()} data-testid={`select-${item.reference}`} aria-label={`Pilih ${item.reference}`}/></span>
        <span className="kode">{item.reference}{item.status==="paid"&&<span className="badge" data-testid={`badge-paid-${item.reference}`}>SUDAH DIBAYAR</span>}{critical&&<span className="badge crit" data-testid={`badge-critical-${item.reference}`}>SELISIH BESAR</span>}</span>
        <span className="pemasok">{item.supplier_name}<small>{new Date(item.created_at).toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})}{isOverdue&&<span className="overdue"> · terbuka {item.days_open} hari</span>}</small></span>
        <span className="baris-ct">{item.days_open||0} hari</span>
        <span className={`angka ${item.total_discrepancy?(item.status==="paid"?"":"merah"):"netral"}`}>{rupiah(item.total_discrepancy)}</span>
        <button className="rek-del icon-btn" onClick={(e)=>remove(item.id, item.reference, e)} data-testid={`delete-reconciliation-${item.reference}`} aria-label={`Hapus ${item.reference}`}><Trash2 size={14}/></button>
      </Link>;})}
    </div>

    {selected.length>0&&<div className="bulk-bar" data-testid="bulk-bar"><span><b>{selected.length}</b> rekonsiliasi terpilih</span><div className="bulk-actions"><button className="btn sm" onClick={()=>bulk("paid")} data-testid="bulk-paid"><CheckCircle2 size={13}/> Tandai sudah dibayar</button><button className="btn sm" onClick={()=>bulk("open")} data-testid="bulk-open"><RotateCcw size={13}/> Kembalikan ke terbuka</button><button className="btn sm danger" onClick={()=>bulk("delete")} data-testid="bulk-delete"><Trash2 size={13}/> Hapus terpilih</button><button className="link" onClick={()=>setSelected([])} data-testid="bulk-clear">Batalkan pilihan</button></div></div>}
    {undo&&<div className="undo" data-testid="undo-banner"><span>Rekonsiliasi <b className="mono">{undo.ref}</b> dihapus.</span><button className="btn sm" onClick={restore} data-testid="undo-restore"><Undo2 size={13}/> Urungkan</button></div>}
  </Layout>;
}

function PasteBox({ title, type, rows, setRows }) {
  const [paste, setPaste] = useState(""); const [uploading, setUploading] = useState(false); const [uploadMsg, setUploadMsg] = useState("");
  const applyPaste = () => { if (!paste.trim()) return; setRows([...rows, ...parseRows(paste, type)]); setPaste(""); };
  const update = (idx, key, value) => { const next=[...rows]; next[idx]={...next[idx],[key]:key==="unit_price"?cleanMoney(value):(key==="quantity"||key==="damaged"?Number(value)||0:value)}; setRows(next); };
  const removeRow = (idx) => setRows(rows.filter((_,i)=>i!==idx));
  const uploadPdf = async (file) => { if(!file) return; setUploading(true); setUploadMsg(""); try { const fd=new FormData(); fd.append("file",file); const r=await axios.post(`${API}/parse-pdf?doc_type=${type}`, fd); const parsed=r.data.rows||[]; setRows([...rows, ...parsed]); const fails=r.data.failures||[]; setUploadMsg(`${parsed.length} baris dibaca dari PDF${fails.length?`, ${fails.length} perlu diperbaiki`:""}.`); setTimeout(()=>setUploadMsg(""), 6000); } catch (e) { setUploadMsg(e?.response?.data?.detail || "Gagal membaca PDF. Coba paste dari Excel."); } finally { setUploading(false); } };
  return <section className={`doc ${type}`} data-testid={`doc-entry-${type}`}>
    <div className="doc-title"><span className="chip-copy">{type === "po" ? "PO" : type === "delivery" ? "SJ" : "FK"}</span><h3>{title}</h3><button className="doc-tool" type="button" onClick={()=>{const blob=new Blob([template(type)],{type:"text/plain"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`template-${type}.tsv`;a.click()}} data-testid={`${type}-template-download`}><Download size={12}/> Template</button></div>
    <div className="upload-row"><label className="upload-lbl" data-testid={`${type}-upload-label`}><input type="file" accept="application/pdf" onChange={e=>uploadPdf(e.target.files?.[0])} data-testid={`${type}-pdf-upload`} disabled={uploading}/> {uploading?"Membaca...":"Impor PDF"}</label><span className="upload-msg" data-testid={`${type}-upload-msg`}>{uploadMsg}</span></div>
    <textarea value={paste} onChange={e=>setPaste(e.target.value)} placeholder={`Tempel dari Excel — tab, koma, atau titik koma.\n${template(type)}`} data-testid={`${type}-paste-input`}/>
    {paste.trim()&&<button className="apply-paste" type="button" onClick={applyPaste} data-testid={`${type}-apply-paste`}>+ Tambahkan {parseRows(paste,type).length} baris</button>}
    {rows.length>0&&<div className="row-editor" data-testid={`${type}-row-editor`}>
      <div className="editor-head"><span>SKU</span><span>Nama</span><span>Sat.</span><span>{type==="delivery"?"Diterima":"Jumlah"}</span><span>{type==="delivery"?"Rusak":"Harga"}</span><span></span></div>
      {rows.map((r,i)=>{const err=rowError(r,type);return <div className={`editor-row ${err?"invalid":""}`} key={i} data-testid={`${type}-row-${i}`}>
        <input className="mono" value={r.sku} onChange={e=>update(i,"sku",e.target.value)} data-testid={`${type}-row-${i}-sku`}/>
        <input value={r.name} onChange={e=>update(i,"name",e.target.value)} data-testid={`${type}-row-${i}-name`}/>
        <input value={r.unit} onChange={e=>update(i,"unit",e.target.value)}/>
        <input type="number" className="mono num" value={r.quantity} onChange={e=>update(i,"quantity",e.target.value)} data-testid={`${type}-row-${i}-qty`}/>
        {type==="delivery"?<input type="number" className="mono num" value={r.damaged} onChange={e=>update(i,"damaged",e.target.value)} data-testid={`${type}-row-${i}-damaged`}/>:<input className="mono num" value={r.unit_price} onChange={e=>update(i,"unit_price",e.target.value)} data-testid={`${type}-row-${i}-price`}/>}
        <button type="button" className="icon-btn" onClick={()=>removeRow(i)} data-testid={`${type}-row-${i}-delete`} aria-label="Hapus"><Trash2 size={12}/></button>
        {err&&<small className="row-error" data-testid={`${type}-row-${i}-error`}>{err}</small>}
      </div>;})}
      <button type="button" className="add-row" onClick={()=>setRows([...rows,emptyRow(type)])} data-testid={`${type}-add-row`}><Plus size={12}/> Tambah baris</button>
    </div>}
  </section>;
}

function NewReconciliation() {
  const nav=useNavigate(); const loc=useLocation();
  const [supplier,setSupplier]=useState(""); const [reference,setReference]=useState("");
  const [po,setPo]=useState([]); const [sj,setSj]=useState([]); const [fk,setFk]=useState([]);
  const [busy,setBusy]=useState(false); const [err,setErr]=useState(""); const [dupNote,setDupNote]=useState("");
  useEffect(()=>{ const p=new URLSearchParams(loc.search); const dup=p.get("duplicate"); if(!dup) return; axios.get(`${API}/reconciliations/${dup}`).then(r=>{const it=r.data; setSupplier(it.supplier_name||""); setPo((it.po_lines||[]).map(x=>({sku:x.sku||"",name:x.name||"",unit:x.unit||"karton",quantity:Number(x.quantity)||0,unit_price:Number(x.unit_price)||0}))); setDupNote(`PO disalin dari ${it.reference}. Tambahkan Surat Jalan dan Faktur untuk melanjutkan.`);}).catch(()=>setErr("Rekonsiliasi sumber tidak ditemukan. Mulai dari nol.")); },[loc.search]);
  const invalid = [...po.map(r=>rowError(r,"po")), ...sj.map(r=>rowError(r,"delivery")), ...fk.map(r=>rowError(r,"faktur"))].some(Boolean);
  const canSubmit = supplier && po.length && sj.length && fk.length && !invalid && !busy;
  const submit=async()=>{setBusy(true);setErr("");try{const payload={supplier_name:supplier,reference,po_number:"",surat_jalan_numbers:[],faktur_number:"",po_lines:po,delivery_lines:sj,invoice_lines:fk};const r=await axios.post(`${API}/reconciliations`,payload);nav(`/rekonsiliasi/${r.data.id}`)}catch(e){setErr("Gagal menyimpan rekonsiliasi. Periksa isian dan coba lagi.");setBusy(false)}};
  return <Layout tag="Masukkan tiga dokumen. Kami cocokkan baris demi baris.">
    <div className="wizard-head"><Link to="/" className="back" data-testid="back-dashboard-link"><ArrowLeft size={13}/> Kembali ke daftar</Link><div className="eyebrow" style={{marginTop:12}}>Rekonsiliasi baru · langkah 1–3</div><h1>Masukkan tiga dokumen</h1><p>Tempel baris dari Excel atau impor PDF, lalu perbaiki apa pun yang salah baca langsung di tabel.</p></div>
    {dupNote&&<div className="dup-note" data-testid="duplicate-note">{dupNote}</div>}
    <div className="meta-form"><label>Nama pemasok<input value={supplier} onChange={e=>setSupplier(e.target.value)} placeholder="Contoh: CV Sumber Pangan Jaya" data-testid="supplier-name-input"/></label><label>Referensi (opsional)<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="REK-2026-0042" data-testid="reference-input"/></label></div>
    <div className="docs-grid"><PasteBox title="Purchase Order" type="po" rows={po} setRows={setPo}/><PasteBox title="Surat Jalan" type="delivery" rows={sj} setRows={setSj}/><PasteBox title="Faktur" type="faktur" rows={fk} setRows={setFk}/></div>
    {invalid&&<div className="warn" data-testid="form-invalid-warning">Ada baris yang belum lengkap. Perbaiki baris merah sebelum menghitung selisih.</div>}
    {err&&<div className="warn" data-testid="form-error">{err}</div>}
    <div className="actions" style={{marginTop:22}}><button className="btn" disabled={!canSubmit} onClick={submit} data-testid="calculate-discrepancy-button">{busy ? "Memeriksa SKU..." : "Hitung selisih →"}</button></div>
  </Layout>;
}

function Comparison({ shared=false }) {
  const {id}=useParams(); const nav=useNavigate();
  const [item,setItem]=useState(null); const [notFound,setNotFound]=useState(false);
  const [notes,setNotes]=useState(""); const [noteStatus,setNoteStatus]=useState("");
  useEffect(()=>{axios.get(`${API}/reconciliations/${id}`).then(r=>{setItem(r.data);setNotes(r.data.notes||"")}).catch(()=>setNotFound(true))},[id]);
  useAnimateOnMount([item?.id]);
  const togglePaid = async () => { const next = item.status==="paid" ? "open" : "paid"; await axios.patch(`${API}/reconciliations/${item.id}/status`, {status: next, actor: getActor()}); const r = await axios.get(`${API}/reconciliations/${item.id}`); setItem(r.data); };
  const saveNotes = async () => { if(notes === (item?.notes||"")) return; setNoteStatus("Menyimpan..."); try { await axios.patch(`${API}/reconciliations/${item.id}/notes`, {notes, actor: getActor()}); const r = await axios.get(`${API}/reconciliations/${item.id}`); setItem(r.data); setNoteStatus("Catatan tersimpan"); setTimeout(()=>setNoteStatus(""), 2500); } catch { setNoteStatus("Gagal menyimpan"); } };
  if(notFound)return <Layout><div className="empty" data-testid="reconciliation-not-found" style={{marginTop:40}}>Rekonsiliasi tidak ditemukan. Periksa kembali tautan atau kembali ke <Link to="/">daftar rekonsiliasi</Link>.</div></Layout>;
  if(!item)return <Layout><div className="loading" data-testid="comparison-loading">Memeriksa dokumen...</div></Layout>;
  const share=`${window.location.origin}/bagikan/${item.share_token}`; const paid = item.status === "paid";
  return <Layout tag={`${item.reference} · ${item.supplier_name}`}>
    <div style={{padding:"20px 0 0"}}><Link to="/" className="back" data-testid="comparison-back-link"><ArrowLeft size={13}/> {shared?"SELISIH":"Daftar rekonsiliasi"}</Link></div>
    <div className="result-head">
      <div><div className="eyebrow mono" style={{marginBottom:6}}>{item.reference}{paid&&<span className="badge crit" data-testid="comparison-paid-badge" style={{marginLeft:10,marginTop:0,borderColor:"var(--muted)",color:"var(--muted)"}}>SUDAH DIBAYAR</span>}</div><h1>{item.supplier_name}</h1><p style={{color:"var(--muted)",marginTop:8}}>Perbandingan PO, Surat Jalan, dan Faktur</p></div>
      <div className="result-total"><span>Total selisih</span><strong className={item.total_discrepancy&&!paid?"bad":"clean"} data-testid="comparison-total">{rupiah(item.total_discrepancy)}</strong></div>
    </div>
    {!shared&&<div className="actions">
      <Link to={`/nota/${item.id}`} className="btn" data-testid="create-return-note-button">Buat nota retur</Link>
      <button className="btn line" onClick={()=>nav(`/baru?duplicate=${item.id}`)} data-testid="duplicate-reconciliation-button"><Copy size={14}/> Duplikat rekonsiliasi</button>
      <button className="btn line" onClick={togglePaid} data-testid="toggle-paid-button">{paid?<><RotateCcw size={14}/> Batalkan status dibayar</>:<><CheckCircle2 size={14}/> Tandai sudah dibayar</>}</button>
      <button className="btn line" onClick={()=>{navigator.clipboard?.writeText(share);window.open(`https://wa.me/?text=${encodeURIComponent(`Mohon periksa selisih dokumen ${item.reference}: ${share}`)}`,"_blank")}} data-testid="share-supplier-button"><Share2 size={14}/> Bagikan ke pemasok</button>
    </div>}
    {!shared&&<section className="notes" data-testid="notes-panel">
      <div className="notes-head"><label htmlFor="notes-input"><b>Catatan rekonsiliasi</b><small>Simpan alasan status atau kesepakatan dengan pemasok.</small></label><span className="notes-status" data-testid="notes-status">{noteStatus}</span></div>
      <textarea id="notes-input" value={notes} onChange={e=>setNotes(e.target.value)} onBlur={saveNotes} placeholder="Contoh: Pemasok setuju retur 88 karton, kirim ulang minggu depan." data-testid="notes-input"/>
    </section>}
    {!shared&&item.history?.length>0&&<section className="history" data-testid="history-panel">
      <div className="history-head"><HistoryIcon size={13}/> <b>Riwayat perubahan</b><small>{item.history.length} entri</small></div>
      <ol className="history-list">{[...item.history].reverse().map((h,i)=><li key={i} data-testid={`history-entry-${i}`}><span className="time">{new Date(h.timestamp).toLocaleString("id-ID",{day:"2-digit",month:"short",hour:"2-digit",minute:"2-digit"})}</span><span className="actor">{h.actor}</span><span className="detail">{h.detail}</span><span className="rel">{relTime(h.timestamp)}</span></li>)}</ol>
    </section>}
    <div className="head"><h2>PERBANDINGAN LINE ITEM</h2><div className="note">{item.products.length} produk</div></div>
    <div className="sheet">{item.products.map(p=><ProductBlok key={p.sku} p={p}/>)}</div>
  </Layout>;
}

function Nota() {
  const {id}=useParams();
  const [item,setItem]=useState(null); const [notFound,setNotFound]=useState(false);
  useEffect(()=>{axios.get(`${API}/reconciliations/${id}`).then(r=>setItem(r.data)).catch(()=>setNotFound(true))},[id]);
  if(notFound)return <div className="wrap"><div className="empty" data-testid="nota-not-found" style={{marginTop:40}}>Nota tidak ditemukan. Kembali ke <Link to="/">daftar rekonsiliasi</Link>.</div></div>;
  if(!item)return null;
  return <div className="nota">
    <div className="doc-actions"><Link to={`/rekonsiliasi/${id}`} data-testid="nota-back-link" style={{color:"var(--muted)"}}>← Kembali</Link><div style={{display:"flex",gap:10}}><a className="btn line sm" href={`${API}/reconciliations/${id}/nota.xlsx`} download data-testid="download-xlsx-button"><FileSpreadsheet size={14}/> Unduh XLSX</a><button className="btn sm" onClick={()=>window.print()} data-testid="print-return-note-button"><Printer size={14}/> Cetak / simpan PDF</button></div></div>
    <div className="doc-header"><div><div className="eyebrow">NOTA RETUR</div><h1>Distributor Anda</h1><p style={{color:"var(--muted)",marginTop:6}}>Nota pengembalian atas selisih dokumen</p></div><div className="doc-code"><span>Nomor nota</span><strong>NR-{item.reference}</strong><span>{new Date().toLocaleDateString("id-ID")}</span></div></div>
    <div className="doc-meta"><span>Dari: <b>Distributor Anda</b></span><span>Kepada: <b>{item.supplier_name}</b></span><span>Referensi: <b>{item.reference}</b></span></div>
    <table><thead><tr><th>SKU</th><th>Jenis selisih</th><th>Produk</th><th>Nilai</th></tr></thead><tbody>{item.products.flatMap(p=>p.issues.filter(x=>x.value).map(x=><tr key={p.sku+x.type}><td className="mono">{p.sku}</td><td>{x.type}</td><td>{p.name}</td><td className="mono">{rupiah(x.value)}</td></tr>))}</tbody></table>
    <div className="claim"><span>Total klaim</span><strong>{rupiah(item.total_discrepancy)}</strong><p>terbilang: {terbilang(item.total_discrepancy)} rupiah</p></div>
    <div className="signatures"><div>Dibuat oleh<div></div><span>Distributor Anda</span></div><div>Disetujui oleh<div></div><span>________________</span></div></div>
  </div>;
}

function Rekap() {
  const [data,setData]=useState(null);
  useEffect(()=>{const now=new Date();const y=now.getFullYear();const m=String(now.getMonth()+1).padStart(2,"0");const first=`${y}-${m}-01`;const last=new Date(y,now.getMonth()+1,0).toISOString().slice(0,10);axios.get(`${API}/reconciliations?start=${first}&end=${last}`).then(r=>setData(r.data));},[]);
  if(!data) return <div className="wrap"><div className="loading">Menyiapkan rekap...</div></div>;
  const monthLabel = data.monthly?.current_label || new Date().toLocaleString("id-ID",{month:"long",year:"numeric"});
  const max = Math.max(1, ...(data.weekly_trend||[]).map(w=>w.total));
  const openItems = data.items.filter(i=>i.status!=="paid"); const paidItems = data.items.filter(i=>i.status==="paid");
  const openTotal = openItems.reduce((a,b)=>a+(b.total_discrepancy||0),0); const paidTotal = paidItems.reduce((a,b)=>a+(b.total_discrepancy||0),0);
  return <div className="rekap">
    <div className="doc-actions"><Link to="/" data-testid="rekap-back-link" style={{color:"var(--muted)"}}>← Kembali</Link><button className="btn sm" onClick={()=>window.print()} data-testid="print-rekap-button"><Printer size={14}/> Cetak / simpan PDF</button></div>
    <div className="doc-header"><div><div className="eyebrow">REKAP BULANAN</div><h1>{monthLabel}</h1><p style={{color:"var(--muted)",marginTop:6}}>Ringkasan rekonsiliasi dokumen bulan berjalan</p></div><div className="doc-code"><span>Disiapkan oleh</span><strong>{getActor()||"Distributor Anda"}</strong><span>{new Date().toLocaleDateString("id-ID",{day:"2-digit",month:"long",year:"numeric"})}</span></div></div>
    <dl className="rekap-metrics">
      <div><dt>Total selisih terbuka</dt><dd className={openTotal?"bad":"clean"}>{rupiah(openTotal)}</dd><small>{openItems.length} rekonsiliasi</small></div>
      <div><dt>Sudah dibayar</dt><dd>{rupiah(paidTotal)}</dd><small>{paidItems.length} rekonsiliasi</small></div>
      <div><dt>Bulan ini vs lalu</dt><dd>{rupiah((data.monthly?.current_month||0)-(data.monthly?.previous_month||0))}</dd><small>{data.monthly?.previous_label||""}</small></div>
    </dl>
    <section className="rekap-chart"><h2>Tren mingguan 8 minggu terakhir</h2><div className="trend-bars">{(data.weekly_trend||[]).map((w,i)=>{const h=Math.max(4,Math.round((w.total/max)*100)); return <div className="trend-col" key={i}><div className="trend-val">{w.total?rupiah(w.total):""}</div><div className="trend-bar" style={{height:`${h}%`}}/><div className="trend-lbl">{w.label}</div></div>;})}</div></section>
    <section className="rekap-block"><h2>Buku besar pemasok</h2><table><thead><tr><th>Pemasok</th><th>Rekonsiliasi</th><th>Total selisih</th></tr></thead><tbody>{(data.supplier_ledger||[]).map(s=><tr key={s.supplier_name}><td>{s.supplier_name}</td><td className="mono">{s.reconciliation_count}</td><td className="mono">{rupiah(s.total_discrepancy)}</td></tr>)}</tbody></table></section>
    <section className="rekap-block"><h2>Daftar rekonsiliasi</h2><table><thead><tr><th>Referensi</th><th>Pemasok</th><th>Tanggal</th><th>Status</th><th>Selisih</th></tr></thead><tbody>{data.items.map(i=><tr key={i.id}><td className="mono">{i.reference}</td><td>{i.supplier_name}</td><td className="mono">{(i.created_at||"").slice(0,10)}</td><td>{i.status==="paid"?"Sudah dibayar":"Terbuka"}</td><td className="mono">{rupiah(i.total_discrepancy)}</td></tr>)}</tbody></table></section>
    <div className="signatures"><div>Disiapkan oleh<div></div><span>{getActor()||"Distributor Anda"}</span></div><div>Disetujui oleh<div></div><span>________________</span></div></div>
  </div>;
}

function App(){return <BrowserRouter><Routes><Route path="/" element={<Dashboard/>}/><Route path="/baru" element={<NewReconciliation/>}/><Route path="/rekonsiliasi/:id" element={<Comparison/>}/><Route path="/bagikan/:id" element={<Comparison shared/>}/><Route path="/nota/:id" element={<Nota/>}/><Route path="/rekap" element={<Rekap/>}/></Routes></BrowserRouter>}
export default App;
