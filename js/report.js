
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
<title>Reporte Tina</title>
<style>
  @page{size:A4;margin:16mm}
  body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#3e3441;margin:0}
  .cover{text-align:center;padding:20px 0 30px;border-bottom:3px solid #d9c1e8}
  .logo{width:96px;height:96px;border-radius:24px;object-fit:cover}
  h1{font-size:30px;margin:10px 0 2px}
  h2{font-size:17px;margin:24px 0 10px;color:#745793}
  p{line-height:1.55}
  .muted{color:#817583}
  .meta{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:20px}
  .meta div{background:#f4edf8;padding:10px;border-radius:10px}
  table{width:100%;border-collapse:collapse;font-size:10px;margin-top:8px}
  th,td{border:1px solid #e6dce7;padding:6px;text-align:center}
  th{background:#f4edf8}
  .note{background:#edf5eb;border-radius:12px;padding:12px;margin:8px 0}
  .page-break{page-break-before:always}
  .comments{height:180px;border:1px solid #ddd2df;border-radius:12px}
  .footer{text-align:center;color:#817583;font-size:10px;margin-top:24px}
  @media print{button{display:none}}
</style>
</head>
<body>
  <section class="cover">
    <img class="logo" src="${new URL("../assets/logo.png", import.meta.url).href}" alt="Logo Tina">
    <h1>Tina</h1>
    <p class="muted">Reporte de adherencia al plan nutricional</p>
    <h2>${escapeHtml(profile.name)}</h2>
    <p><strong>Periodo:</strong> ${formatDate(blocks[0].start)} al ${formatDate(blocks[3].end)}</p>
  </section>

  <h2>Plan vigente al cierre del periodo</h2>
  <div class="meta">
    ${categories.map(c=>`<div><strong>${c.label}</strong><br>${latestPlan.goals[c.id]} porciones</div>`).join("")}
    <div><strong>Ejercicio</strong><br>${exerciseGoal} días por semana</div>
  </div>

  <h2>Resumen ejecutivo</h2>
  <div class="note">${summaryText}</div>

  <h2>Evolución semanal</h2>
  <table>
    <thead><tr><th>Semana</th><th>Periodo</th><th>Registros</th><th>Plan completo</th><th>Adherencia</th><th>Ejercicio</th></tr></thead>
    <tbody>${weeklyRows}</tbody>
  </table>

  <h2>Promedios por grupo</h2>
  <table>
    <thead><tr><th>Grupo</th><th>Meta actual</th><th>Promedio</th><th>Días por debajo</th><th>Días por encima</th></tr></thead>
    <tbody>${averages}</tbody>
  </table>

  <h2>Observaciones automáticas</h2>
  ${observations.map(o=>`<div class="note">${escapeHtml(o)}</div>`).join("")}

  <div class="page-break"></div>
  <h2>Registro diario</h2>
  <table>
    <thead><tr><th>Fecha</th><th>Plan</th><th>Ej.</th><th>P</th><th>V</th><th>F</th><th>H</th><th>G</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <h2>Comentarios del profesional</h2>
  <div class="comments"></div>

  <div class="footer">Generado por Tina · Tu plan, un día a la vez.</div>
  <script>window.addEventListener("load",()=>setTimeout(()=>window.print(),300));</script>
</body>
</html>`;

  const win=window.open("","_blank");
  if(!win) throw new Error("El navegador bloqueó la ventana del reporte.");
  win.document.open();
  win.document.write(report);
  win.document.close();
}
