
import {categories, parseDate, addDays, isoLocal, formatDate, formatShort, activePlanForDate, dayStatus} from "./utils.js";

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[char]));
}

function sevenDayBlock(endDate, blockIndex){
  const end = addDays(endDate, -7*blockIndex);
  const start = addDays(end, -6);
  const dates=[];
  for(let i=0;i<7;i++) dates.push(isoLocal(addDays(start,i)));
  return {start,end,dates};
}

function evaluateWeek(records, profile, block){
  const registered = block.dates.filter(key=>records[key]);
  const exercise = registered.filter(key=>records[key].exercise).length;
  const complete = registered.filter(key=>{
    const plan=activePlanForDate(profile,key);
    return dayStatus(records[key].portions,plan.goals).complete;
  }).length;
  const adherence = registered.length ? Math.round(complete/registered.length*100) : 0;
  return {registered,exercise,complete,adherence};
}

function aggregate(records, profile, allDates){
  const registered=allDates.filter(key=>records[key]);
  const complete=registered.filter(key=>{
    const plan=activePlanForDate(profile,key);
    return dayStatus(records[key].portions,plan.goals).complete;
  }).length;

  const stats={};
  categories.forEach(c=>{
    let total=0, under=0, over=0;
    registered.forEach(key=>{
      const value=records[key].portions[c.id]||0;
      const goal=activePlanForDate(profile,key).goals[c.id];
      total+=value;
      if(value<goal) under++;
      if(value>goal) over++;
    });
    stats[c.id]={average:registered.length?total/registered.length:0,under,over};
  });

  return {registered,complete,adherence:registered.length?Math.round(complete/registered.length*100):0,stats};
}

export function openFourWeekReport(records, profile, selectedDateKey){
  const endDate=parseDate(selectedDateKey);
  const blocks=[3,2,1,0].map(i=>sevenDayBlock(endDate,i));
  const allDates=blocks.flatMap(b=>b.dates);
  const overall=aggregate(records,profile,allDates);
  const weekly=blocks.map((b,i)=>({...b,label:`Semana ${i+1}`,...evaluateWeek(records,profile,b)}));

  const latestPlan=activePlanForDate(profile,selectedDateKey);
  const exerciseGoal=profile.exerciseGoal;
  const metExerciseWeeks=weekly.filter(w=>w.exercise>=exerciseGoal).length;

  const observations=[];
  if(overall.stats.proteinas.under) observations.push(`La meta de proteínas no se alcanzó en ${overall.stats.proteinas.under} días registrados.`);
  if(overall.stats.vegetales.under) observations.push(`La meta mínima de vegetales no se alcanzó en ${overall.stats.vegetales.under} días.`);
  for(const id of ["frutas","harinas","grasas"]){
    const n=overall.stats[id].over;
    if(n) observations.push(`Hubo exceso de ${categories.find(c=>c.id===id).label.toLowerCase()} en ${n} días.`);
  }
  if(!observations.length) observations.push("No se identificaron excesos ni déficits relevantes en los días registrados.");

  const rows=allDates.map(key=>{
    const rec=records[key];
    if(!rec){
      return `<tr><td>${formatShort(parseDate(key))}</td><td colspan="8" class="muted">Sin registro</td></tr>`;
    }
    const plan=activePlanForDate(profile,key);
    const status=dayStatus(rec.portions,plan.goals);
    return `<tr>
      <td>${formatShort(parseDate(key))}</td>
      <td>${status.complete?"Sí":"No"}</td>
      <td>${rec.exercise?"Sí":"No"}</td>
      ${categories.map(c=>`<td>${rec.portions[c.id]||0}/${plan.goals[c.id]}</td>`).join("")}
    </tr>`;
  }).join("");

  const weeklyRows=weekly.map(w=>`
    <tr>
      <td>${w.label}</td>
      <td>${formatShort(w.start)}–${formatShort(w.end)}</td>
      <td>${w.registered.length}/7</td>
      <td>${w.complete}</td>
      <td>${w.adherence}%</td>
      <td>${w.exercise}/${exerciseGoal}${w.exercise>=exerciseGoal?" ✓":""}</td>
    </tr>`).join("");

  const averages=categories.map(c=>`
    <tr>
      <td>${c.label}</td>
      <td>${latestPlan.goals[c.id]}</td>
      <td>${overall.stats[c.id].average.toFixed(1)}</td>
      <td>${overall.stats[c.id].under}</td>
      <td>${c.mode==="exact"?overall.stats[c.id].over:"Sin alerta"}</td>
    </tr>`).join("");

  const summaryText = overall.registered.length
    ? `Durante estas cuatro semanas se registraron ${overall.registered.length} de 28 días. El plan completo se cumplió en ${overall.complete} días, para una adherencia de ${overall.adherence}%. La meta semanal de ejercicio se alcanzó en ${metExerciseWeeks} de 4 semanas.`
    : "No hay registros en el periodo seleccionado.";

  const report = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Reporte Tina</title>
<style>
  :root{
    --bg:#fdf8fb;
    --panel:#ffffff;
    --text:#3e3441;
    --muted:#817583;
    --border:#eadfea;
    --lilac:#c9afe0;
    --lilac-deep:#9877bb;
    --lilac-soft:#f2ebf8;
    --pink-soft:#f8edf3;
    --sage:#a9c7a4;
    --sage-soft:#edf5eb;
    --amber-soft:#fbf3d9;
    --danger-soft:#fbe8e8;
    --shadow:0 12px 30px rgba(82,56,82,.08);
  }

  *{box-sizing:border-box}

  body{
    margin:0;
    color:var(--text);
    background:linear-gradient(180deg,#fdf8fb 0%,#f7f3fa 100%);
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
  }

  .report-shell{
    width:min(860px,100%);
    margin:auto;
    padding:22px 14px 40px;
  }

  .hero{
    display:flex;
    align-items:center;
    gap:16px;
    margin-bottom:16px;
  }

  .logo{
    width:82px;
    height:82px;
    object-fit:cover;
    border-radius:22px;
    box-shadow:var(--shadow);
    flex:0 0 auto;
  }

  h1,h2,h3,p{margin:0}
  h1{font-size:1.8rem}
  h2{font-size:1.08rem;margin-bottom:10px}
  h3{font-size:.98rem}
  p{line-height:1.55}
  .muted{color:var(--muted)}

  .card{
    background:rgba(255,255,255,.96);
    border:1px solid var(--border);
    border-radius:22px;
    padding:16px;
    box-shadow:var(--shadow);
    margin-bottom:14px;
    break-inside:avoid;
  }

  .tint-lilac{background:var(--lilac-soft)}
  .tint-pink{background:var(--pink-soft)}
  .tint-sage{background:var(--sage-soft)}

  .meta-grid{
    display:grid;
    grid-template-columns:repeat(3,1fr);
    gap:10px;
    margin-top:12px;
  }

  .meta-card{
    background:#fff;
    border:1px solid var(--border);
    border-radius:16px;
    padding:12px;
  }

  .meta-card strong{
    display:block;
    margin-bottom:3px;
  }

  .stats-grid{
    display:grid;
    grid-template-columns:repeat(4,1fr);
    gap:9px;
    margin-top:12px;
  }

  .stat{
    background:#fff;
    border:1px solid var(--border);
    border-radius:16px;
    padding:12px;
    text-align:center;
  }

  .stat strong{
    display:block;
    font-size:1.35rem;
    margin-top:4px;
  }

  .week-list{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:10px;
    margin-top:12px;
  }

  .week-card{
    background:#fff;
    border:1px solid var(--border);
    border-radius:18px;
    padding:13px;
  }

  .week-top{
    display:flex;
    justify-content:space-between;
    gap:10px;
    align-items:flex-start;
    margin-bottom:10px;
  }

  .pill{
    display:inline-block;
    padding:5px 9px;
    border-radius:999px;
    background:var(--lilac-soft);
    color:var(--lilac-deep);
    font-size:.78rem;
    font-weight:700;
  }

  .progress{
    height:10px;
    border-radius:999px;
    background:#f0ebf1;
    overflow:hidden;
    margin-top:8px;
  }

  .progress > span{
    display:block;
    height:100%;
    border-radius:inherit;
    background:var(--lilac-deep);
  }

  .group-list{
    display:grid;
    gap:10px;
    margin-top:12px;
  }

  .group-row{
    display:grid;
    grid-template-columns:minmax(120px,1fr) 1.6fr auto;
    gap:12px;
    align-items:center;
    background:#fff;
    border:1px solid var(--border);
    border-radius:16px;
    padding:11px 12px;
  }

  .group-bar{
    height:10px;
    border-radius:999px;
    background:#f0ebf1;
    overflow:hidden;
  }

  .group-bar span{
    display:block;
    height:100%;
    border-radius:inherit;
    background:var(--sage);
  }

  .observation{
    background:#fff;
    border:1px solid var(--border);
    border-left:5px solid var(--lilac);
    border-radius:16px;
    padding:12px 14px;
    margin-top:9px;
  }

  .daily-grid{
    display:grid;
    grid-template-columns:repeat(2,1fr);
    gap:10px;
  }

  .day-card{
    background:#fff;
    border:1px solid var(--border);
    border-radius:18px;
    padding:13px;
    break-inside:avoid;
  }

  .day-head{
    display:flex;
    justify-content:space-between;
    align-items:flex-start;
    gap:10px;
    margin-bottom:10px;
  }

  .day-status{
    font-size:.78rem;
    font-weight:700;
    padding:5px 8px;
    border-radius:999px;
    background:var(--amber-soft);
  }

  .day-status.complete{background:var(--sage-soft)}

  .portion-mini-grid{
    display:grid;
    grid-template-columns:repeat(5,1fr);
    gap:6px;
  }

  .portion-mini{
    background:#f9f6fa;
    border-radius:12px;
    padding:8px 4px;
    text-align:center;
    font-size:.82rem;
  }

  .comments{
    min-height:180px;
    border:1.5px dashed #d8cadb;
    border-radius:18px;
    background:#fff;
  }

  .print-button{
    width:100%;
    border:none;
    border-radius:16px;
    padding:14px 16px;
    background:var(--lilac-deep);
    color:white;
    font-weight:700;
    font-size:1rem;
    margin-top:6px;
    cursor:pointer;
  }

  .footer{
    text-align:center;
    color:var(--muted);
    font-size:.82rem;
    margin-top:18px;
  }

  @media(max-width:680px){
    .meta-grid,.stats-grid,.week-list,.daily-grid{grid-template-columns:1fr}
    .group-row{grid-template-columns:1fr}
    .hero{align-items:flex-start}
    .logo{width:68px;height:68px;border-radius:18px}
  }

  @media print{
    @page{size:A4;margin:12mm}
    body{
      background:#fff;
      -webkit-print-color-adjust:exact;
      print-color-adjust:exact;
    }
    .report-shell{
      width:100%;
      padding:0;
    }
    .card{
      box-shadow:none;
    }
    .print-button{
      display:none!important;
    }
    .daily-grid{
      grid-template-columns:repeat(2,1fr);
    }
    .week-list{
      grid-template-columns:repeat(2,1fr);
    }
    .page-break{
      break-before:page;
    }
  }
</style>
</head>
<body>
  <main class="report-shell">
    <header class="hero">
      <img class="logo" src="${new URL("../assets/logo.png", import.meta.url).href}" alt="Logo de Tina">
      <div>
        <h1>Tina</h1>
        <p class="muted">Reporte de adherencia al plan nutricional</p>
        <p style="margin-top:8px"><strong>${escapeHtml(profile.name)}</strong></p>
        <p class="muted">${formatDate(blocks[0].start)} al ${formatDate(blocks[3].end)}</p>
      </div>
    </header>

    <section class="card tint-lilac">
      <h2>Resumen ejecutivo</h2>
      <p>${summaryText}</p>

      <div class="stats-grid">
        <div class="stat">
          <span class="muted">Días registrados</span>
          <strong>${overall.registered.length}/28</strong>
        </div>
        <div class="stat">
          <span class="muted">Plan completo</span>
          <strong>${overall.complete}</strong>
        </div>
        <div class="stat">
          <span class="muted">Adherencia</span>
          <strong>${overall.adherence}%</strong>
        </div>
        <div class="stat">
          <span class="muted">Meta de ejercicio</span>
          <strong>${metExerciseWeeks}/4</strong>
        </div>
      </div>
    </section>

    <section class="card tint-pink">
      <h2>Plan vigente al cierre del periodo</h2>
      <div class="meta-grid">
        ${categories.map(c=>`
          <div class="meta-card">
            <strong>${c.emoji} ${c.label}</strong>
            <span>${latestPlan.goals[c.id]} porciones</span>
          </div>`).join("")}
        <div class="meta-card">
          <strong>🏃 Ejercicio</strong>
          <span>${exerciseGoal} días por semana</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Evolución semanal</h2>
      <div class="week-list">
        ${weekly.map(w=>`
          <article class="week-card">
            <div class="week-top">
              <div>
                <h3>${w.label}</h3>
                <p class="muted">${formatShort(w.start)}–${formatShort(w.end)}</p>
              </div>
              <span class="pill">${w.adherence}%</span>
            </div>
            <p><strong>${w.complete}</strong> días con plan completo</p>
            <p class="muted">${w.registered.length}/7 días registrados · ejercicio ${w.exercise}/${exerciseGoal}${w.exercise>=exerciseGoal?" ✓":""}</p>
            <div class="progress"><span style="width:${Math.min(100,w.adherence)}%"></span></div>
          </article>`).join("")}
      </div>
    </section>

    <section class="card tint-sage">
      <h2>Promedios por grupo</h2>
      <div class="group-list">
        ${categories.map(c=>{
          const average=overall.stats[c.id].average;
          const goal=latestPlan.goals[c.id] || 0;
          const pct=goal ? Math.min(100,(average/goal)*100) : 100;
          return `
          <div class="group-row">
            <div><strong>${c.emoji} ${c.label}</strong><div class="muted">Meta ${goal}</div></div>
            <div class="group-bar"><span style="width:${pct}%"></span></div>
            <div><strong>${average.toFixed(1)}</strong> prom.</div>
          </div>`;
        }).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Observaciones automáticas</h2>
      ${observations.map(o=>`<div class="observation">${escapeHtml(o)}</div>`).join("")}
    </section>

    <section class="card page-break">
      <h2>Registro diario</h2>
      <div class="daily-grid">
        ${allDates.map(key=>{
          const rec=records[key];
          if(!rec){
            return `
              <article class="day-card">
                <div class="day-head">
                  <div>
                    <h3>${formatShort(parseDate(key))}</h3>
                    <p class="muted">Sin registro</p>
                  </div>
                  <span class="day-status">Sin datos</span>
                </div>
              </article>`;
          }
          const plan=activePlanForDate(profile,key);
          const status=dayStatus(rec.portions,plan.goals);
          return `
            <article class="day-card">
              <div class="day-head">
                <div>
                  <h3>${formatShort(parseDate(key))}</h3>
                  <p class="muted">Ejercicio: ${rec.exercise?"Sí":"No"}</p>
                </div>
                <span class="day-status ${status.complete?"complete":""}">${status.complete?"Plan completo":"Plan incompleto"}</span>
              </div>
              <div class="portion-mini-grid">
                ${categories.map(c=>`
                  <div class="portion-mini">
                    <div>${c.emoji}</div>
                    <strong>${rec.portions[c.id]||0}/${plan.goals[c.id]}</strong>
                  </div>`).join("")}
              </div>
            </article>`;
        }).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Comentarios del profesional</h2>
      <div class="comments"></div>
    </section>

    <button id="printReportButton" class="print-button" type="button">Guardar como PDF</button>

    <div class="footer">Generado por Tina · Tu plan, un día a la vez.</div>
  </main>

  <script>
    document.getElementById("printReportButton").addEventListener("click",()=>window.print());
  </script>
</body>
</html>`;

  const win=window.open("","_blank");
  if(!win) throw new Error("El navegador bloqueó la ventana del reporte.");
  win.document.open();
  win.document.write(report);
  win.document.close();
}
