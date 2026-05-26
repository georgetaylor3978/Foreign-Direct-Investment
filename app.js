'use strict';
Chart.defaults.font.family = "'Inter', system-ui, sans-serif";
Chart.defaults.animation.duration = 400;

let DATA = null; // { quarterly, years, quarters }
let currentView = 'net', currentCtype = 'bar', currentGran = 'annual', currentCountry = 'All countries';
let mainInst = null, compInst = null, usRowInst = null;

const C = {
  green:'rgb(0,229,160)', greenA:'rgba(0,229,160,0.75)', greenF:'rgba(0,229,160,0.12)',
  red:'rgb(255,77,109)',   redA:'rgba(255,77,109,0.75)',   redF:'rgba(255,77,109,0.12)',
  blue:'rgb(79,172,254)',  blueA:'rgba(79,172,254,0.6)',
  gold:'rgb(247,201,107)', purple:'rgb(167,139,250)', orange:'rgb(255,159,64)'
};

function isDark(){return !document.body.classList.contains('light');}
function fmtB(v){if(v==null)return'—';const a=Math.abs(v);if(a>=1e6)return(v/1e6).toFixed(1)+'T';if(a>=1e3)return(v/1e3).toFixed(1)+'B';return v.toLocaleString('en-CA')+'M';}
function fmtFull(v){if(v==null)return'—';return(v>=0?'+':'')+v.toLocaleString('en-CA');}
function cc(){const d=isDark();return{grid:d?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)',tick:d?'#6c7a8e':'#5a6880',text:d?'#d0d8e4':'#1a2336',ttBg:d?'rgba(10,14,20,0.96)':'rgba(255,255,255,0.97)',ttBd:d?'rgba(255,255,255,0.1)':'rgba(0,0,0,0.1)'};}

function baseOpts(){
  const c=cc();
  return {
    responsive:true, maintainAspectRatio:false,
    plugins:{
      legend:{labels:{color:c.text,font:{size:12,weight:'600'},usePointStyle:true,pointStyleWidth:20,padding:16}},
      tooltip:{backgroundColor:c.ttBg,borderColor:c.ttBd,borderWidth:1,titleColor:c.text,bodyColor:c.tick,padding:12,
        callbacks:{label:ctx=>{const v=ctx.parsed.y??ctx.parsed;return` ${ctx.dataset.label}: ${v>=0?'+':''}${Math.round(v).toLocaleString('en-CA')} M`;}}}
    },
    scales:{
      x:{ticks:{color:c.tick,font:{size:10},maxRotation:45},grid:{color:c.grid},border:{color:c.grid}},
      y:{ticks:{color:c.tick,font:{size:11},callback:v=>(v>=0?'+':'')+(v/1000).toFixed(0)+'B'},grid:{color:(ctx2)=>ctx2.tick.value===0?(isDark()?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.2)'):cc().grid},border:{color:c.grid}}
    }
  };
}

// ── MAIN CHART ──────────────────────────────────────────────────────────────
function renderMainChart(){
  const isQ = currentGran==='quarterly';
  const rows = isQ ? buildQuarterlyRows(DATA.quarterly,DATA.quarters,currentCountry) : buildAnnualRows(DATA.quarterly,DATA.years,currentCountry);
  const labels = rows.map(r=>isQ?r.quarter:r.year.toString());

  let datasets=[];
  if(currentView==='net'){
    const vals=rows.map(r=>r.net);
    if(currentCtype==='line'){
      datasets=[{label:'Net Inflow/(Flight)',data:vals,borderColor:C.blue,backgroundColor:'rgba(79,172,254,0.15)',fill:true,tension:0.3,pointRadius:isQ?2:5,pointBackgroundColor:vals.map(v=>v>=0?C.green:C.red),borderWidth:2.5}];
    } else {
      datasets=[{label:'Net Inflow/(Flight)',data:vals,backgroundColor:vals.map(v=>v>=0?C.greenA:C.redA),borderColor:vals.map(v=>v>=0?C.green:C.red),borderWidth:1.5,borderRadius:4}];
    }
  } else if(currentView==='inflow'){
    const vals=rows.map(r=>r.inflow);
    if(currentCtype==='line') datasets=[{label:'Inflow (Foreign in CA)',data:vals,borderColor:C.green,backgroundColor:C.greenF,fill:true,tension:0.3,pointRadius:isQ?2:5,pointBackgroundColor:C.green,borderWidth:2.5}];
    else datasets=[{label:'Inflow (Foreign in CA)',data:vals,backgroundColor:C.greenA,borderColor:C.green,borderWidth:1.5,borderRadius:4}];
  } else if(currentView==='outflow'){
    const vals=rows.map(r=>r.outflow!=null?-r.outflow:null);
    if(currentCtype==='line') datasets=[{label:'Outflow (CA Abroad)',data:vals,borderColor:C.red,backgroundColor:C.redF,fill:true,tension:0.3,pointRadius:isQ?2:5,pointBackgroundColor:C.red,borderWidth:2.5}];
    else datasets=[{label:'Outflow (CA Abroad)',data:vals,backgroundColor:C.redA,borderColor:C.red,borderWidth:1.5,borderRadius:4}];
  } else { // both
    const inf=rows.map(r=>r.inflow), outf=rows.map(r=>r.outflow!=null?-r.outflow:null);
    if(currentCtype==='line'){
      datasets=[
        {label:'Inflow (Foreign in CA)',data:inf,borderColor:C.green,backgroundColor:C.greenF,fill:true,tension:0.3,pointRadius:isQ?2:5,pointBackgroundColor:C.green,borderWidth:2.5},
        {label:'Outflow (CA Abroad)',data:outf,borderColor:C.red,backgroundColor:C.redF,fill:true,tension:0.3,pointRadius:isQ?2:5,pointBackgroundColor:C.red,borderWidth:2.5}
      ];
    } else {
      datasets=[
        {label:'Inflow (Foreign in CA)',data:inf,backgroundColor:C.greenA,borderColor:C.green,borderWidth:1.5,borderRadius:4},
        {label:'Outflow (CA Abroad)',data:outf,backgroundColor:C.redA,borderColor:C.red,borderWidth:1.5,borderRadius:4}
      ];
    }
  }

  const opts=baseOpts();
  if(mainInst)mainInst.destroy();
  mainInst=new Chart(document.getElementById('mainChart'),{type:currentCtype==='line'?'line':'bar',data:{labels,datasets},options:opts});

  const viewL={'net':'Net Capital Inflow / (Flight)','both':'Inflow & Outflow','inflow':'Foreign Investment Inflow','outflow':'Capital Flight (Outflow)'};
  const cL=currentCountry==='All countries'?'All Countries':currentCountry;
  document.getElementById('mainChartTitle').textContent=`${viewL[currentView]} — ${cL}`;
}

// ── COMPONENT CHART ─────────────────────────────────────────────────────────
function renderComponentChart(){
  const rows=buildComponentRows(DATA.quarterly,DATA.years);
  const labels=rows.map(r=>r.year.toString());
  const opts=baseOpts();
  opts.scales.y.stacked=true; opts.scales.x.stacked=true;
  if(compInst)compInst.destroy();
  compInst=new Chart(document.getElementById('componentChart'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'M&A',data:rows.map(r=>r.outMA),backgroundColor:'rgba(79,172,254,0.7)',borderColor:C.blue,borderWidth:1,borderRadius:3,stack:'s'},
      {label:'Reinvested Earnings',data:rows.map(r=>r.outRE),backgroundColor:'rgba(0,229,160,0.7)',borderColor:C.green,borderWidth:1,borderRadius:3,stack:'s'},
      {label:'Other Flows',data:rows.map(r=>r.outOther),backgroundColor:'rgba(247,201,107,0.7)',borderColor:C.gold,borderWidth:1,borderRadius:3,stack:'s'}
    ]},options:opts
  });
}

// ── US vs ROW CHART ─────────────────────────────────────────────────────────
function renderUsVsRowChart(){
  const usRows=buildAnnualRows(DATA.quarterly,DATA.years,'United States');
  const rowRows=buildAnnualRows(DATA.quarterly,DATA.years,'All other countries');
  const labels=DATA.years.map(String);
  const opts=baseOpts();
  opts.scales.y.stacked=true; opts.scales.x.stacked=true;
  if(usRowInst)usRowInst.destroy();
  usRowInst=new Chart(document.getElementById('usVsRowChart'),{
    type:'bar',
    data:{labels,datasets:[
      {label:'United States',data:usRows.map(r=>r.outflow),backgroundColor:'rgba(79,172,254,0.7)',borderColor:C.blue,borderWidth:1,borderRadius:3,stack:'s'},
      {label:'All Other Countries',data:rowRows.map(r=>r.outflow),backgroundColor:'rgba(167,139,250,0.7)',borderColor:C.purple,borderWidth:1,borderRadius:3,stack:'s'}
    ]},options:opts
  });
}

// ── KPIs ────────────────────────────────────────────────────────────────────
function updateKPIs(){
  const rows=buildAnnualRows(DATA.quarterly,DATA.years);
  const latest=rows.filter(r=>r.net!=null).pop();
  const cumNet=rows.reduce((s,r)=>s+(r.net??0),0);

  if(latest){
    document.getElementById('kpiNetLabel').textContent=`Net Flow (${latest.year})`;
    const el=document.getElementById('kpiNetVal');
    el.textContent=fmtB(latest.net);
    el.className='kpi-value '+(latest.net>=0?'positive':'negative');
    document.getElementById('kpiNetSub').textContent=latest.net>=0?'More came IN than went out':'More money LEFT Canada';

    document.getElementById('kpiInflowVal').textContent='+'+fmtB(latest.inflow);
    document.getElementById('kpiInflowSub').textContent=`${latest.year} total inflow`;
    document.getElementById('kpiOutflowVal').textContent=fmtB(latest.outflow)+' left';
    document.getElementById('kpiOutflowSub').textContent=`${latest.year} total outflow`;
  }
  const cumEl=document.getElementById('kpiCumVal');
  cumEl.textContent=fmtB(cumNet);
  cumEl.className='kpi-value '+(cumNet>=0?'positive':'negative');
}

// ── TABLE ───────────────────────────────────────────────────────────────────
function renderTable(){
  const rows=buildAnnualRows(DATA.quarterly,DATA.years).filter(r=>r.outflow!=null||r.inflow!=null).reverse();
  const tbody=document.getElementById('tableBody');
  tbody.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    const nc=r.net==null?'':r.net>=0?'net-pos':'net-neg';
    tr.innerHTML=`<td><span class="year-badge">${r.year}</span></td>
      <td class="num-col pos-val">${r.inflow!=null?'+'+r.inflow.toLocaleString('en-CA'):'—'}</td>
      <td class="num-col neg-val">${r.outflow!=null?r.outflow.toLocaleString('en-CA'):'—'}</td>
      <td class="num-col ${nc}">${r.net!=null?fmtFull(r.net):'—'}</td>`;
    tbody.appendChild(tr);
  });
}

// ── RENDER ALL ──────────────────────────────────────────────────────────────
function renderAll(){renderMainChart();renderComponentChart();renderUsVsRowChart();updateKPIs();renderTable();}

// ── EVENTS ──────────────────────────────────────────────────────────────────
function segClick(containerId,varName,cb){
  document.getElementById(containerId).addEventListener('click',e=>{
    const btn=e.target.closest('.seg-btn');if(!btn)return;
    const attr=btn.dataset.view||btn.dataset.ctype||btn.dataset.gran;
    if(varName==='view')currentView=attr;
    else if(varName==='ctype')currentCtype=attr;
    else if(varName==='gran')currentGran=attr;
    document.querySelectorAll(`#${containerId} .seg-btn`).forEach(b=>b.classList.remove('active'));
    btn.classList.add('active');
    cb();
  });
}

function initControls(){
  segClick('viewToggle','view',renderMainChart);
  segClick('chartTypeToggle','ctype',renderMainChart);
  segClick('granToggle','gran',renderMainChart);
  document.getElementById('countrySelect').addEventListener('change',e=>{currentCountry=e.target.value;renderMainChart();});
  document.getElementById('themeToggle').addEventListener('click',()=>{document.body.classList.toggle('light');renderAll();});
}

// ── INIT ────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async ()=>{
  document.getElementById('footerYear').textContent=new Date().getFullYear();
  initControls();
  try{
    DATA=await loadData();
    renderAll();
  }catch(err){
    console.error('Failed to load data:',err);
    document.querySelector('main').innerHTML='<div style="text-align:center;padding:4rem;color:var(--muted)"><h2>⚠️ Data Load Error</h2><p>Could not load CSV. Make sure the CapFlightData folder is present.</p><p style="font-size:0.8rem;margin-top:1rem">'+err.message+'</p></div>';
  }
});
