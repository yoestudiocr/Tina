
import {
  categories,
  parseDate,
  addDays,
  isoLocal,
  formatDate,
  formatShort,
  activePlanForDate,
  dayStatus
} from "./utils.js";

function escapeHtml(value){
  return String(value).replace(/[&<>"']/g, char => ({
    "&":"&amp;",
    "<":"&lt;",
    ">":"&gt;",
    '"':"&quot;",
    "'":"&#039;"
  }[char]));
}

function sevenDayBlock(endDate, blockIndex){
  const end = addDays(endDate, -7 * blockIndex);
  const start = addDays(end, -6);
  const dates = [];
  for(let i=0;i<7;i++) dates.push(isoLocal(addDays(start,i)));
  return {start,end,dates};
}

function evaluateWeek(records, profile, block){
  const registered = block.dates.filter(key => records[key]);
  const exercise = registered.filter(key => records[key].exercise).length;
  const complete = registered.filter(key => {
    const plan = activePlanForDate(profile,key);
    return dayStatus(records[key].portions,plan.goals).complete;
  }).length;
  const adherence = registered.length ? Math.round((complete / registered.length) * 100) : 0;
  return {registered,exercise,complete,adherence};
}

function aggregate(records, profile, allDates){
  const registered = allDates.filter(key => records[key]);
  const complete = registered.filter(key => {
    const plan = activePlanForDate(profile,key);
    return dayStatus(records[key].portions,plan.goals).complete;
  }).length;

  const stats = {};
  categories.forEach(category => {
    let total = 0;
    let under = 0;
    let over = 0;

    registered.forEach(key => {
      const value = records[key].portions[category.id] || 0;
      const goal = activePlanForDate(profile,key).goals[category.id];
      total += value;
      if(value < goal) under++;
      if(value > goal) over++;
    });

    stats[category.id] = {
      average: registered.length ? total / registered.length : 0,
      under,
      over
    };
  });

  return {
    registered,
    complete,
    adherence: registered.length ? Math.round((complete / registered.length) * 100) : 0,
    stats
  };
}

export function renderFourWeekReport(records, profile, selectedDateKey){
  const endDate = parseDate(selectedDateKey);
  const blocks = [3,2,1,0].map(index => sevenDayBlock(endDate,index));
  const allDates = blocks.flatMap(block => block.dates);
  const overall = aggregate(records,profile,allDates);
  const weekly = blocks.map((block,index) => ({
    ...block,
    label:`Semana ${index+1}`,
    ...evaluateWeek(records,profile,block)
  }));

  const latestPlan = activePlanForDate(profile,selectedDateKey);
  const exerciseGoal = profile.exerciseGoal;
  const metExerciseWeeks = weekly.filter(week => week.exercise >= exerciseGoal).length;

  const observations = [];
  if(overall.stats.proteinas.under){
    observations.push(`La meta de proteínas no se alcanzó en ${overall.stats.proteinas.under} días registrados.`);
  }
  if(overall.stats.vegetales.under){
    observations.push(`La meta mínima de vegetales no se alcanzó en ${overall.stats.vegetales.under} días.`);
  }

  for(const id of ["frutas","harinas","grasas"]){
    const count = overall.stats[id].over;
    if(count){
      const label = categories.find(category => category.id === id).label.toLowerCase();
      observations.push(`Hubo exceso de ${label} en ${count} días.`);
    }
  }

  if(!observations.length){
    observations.push("No se identificaron excesos ni déficits relevantes en los días registrados.");
  }

  const summaryText = overall.registered.length
    ? `Durante estas cuatro semanas se registraron ${overall.registered.length} de 28 días. El plan completo se cumplió en ${overall.complete} días, para una adherencia de ${overall.adherence}%. La meta semanal de ejercicio se alcanzó en ${metExerciseWeeks} de 4 semanas.`
    : "No hay registros en el periodo seleccionado.";

  return `
    <header class="report-hero">
      <img class="report-logo" src="assets/logo.png" alt="Logo de Tina">
      <div>
        <h1 class="report-title">Tina</h1>
        <p class="report-subtitle">Reporte de adherencia al plan nutricional</p>
        <p class="report-person">${escapeHtml(profile.name)}</p>
        <p class="report-period">${formatDate(blocks[0].start)} al ${formatDate(blocks[3].end)}</p>
      </div>
    </header>

    <section class="card tint-lilac">
      <h2>Resumen ejecutivo</h2>
      <p>${escapeHtml(summaryText)}</p>

      <div class="report-stats">
        <div class="report-stat"><span>Días registrados</span><strong>${overall.registered.length}/28</strong></div>
        <div class="report-stat"><span>Plan completo</span><strong>${overall.complete}</strong></div>
        <div class="report-stat"><span>Adherencia</span><strong>${overall.adherence}%</strong></div>
        <div class="report-stat"><span>Meta de ejercicio</span><strong>${metExerciseWeeks}/4</strong></div>
      </div>
    </section>

    <section class="card tint-pink">
      <h2>Plan vigente al cierre del periodo</h2>
      <div class="report-meta-grid">
        ${categories.map(category => `
          <div class="report-meta">
            <strong>${category.emoji} ${category.label}</strong>
            <span>${latestPlan.goals[category.id]} porciones</span>
          </div>
        `).join("")}
        <div class="report-meta">
          <strong>🏃 Ejercicio</strong>
          <span>${exerciseGoal} días por semana</span>
        </div>
      </div>
    </section>

    <section class="card">
      <h2>Evolución semanal</h2>
      <div class="report-week-grid">
        ${weekly.map(week => `
          <article class="report-week-card">
            <div class="report-week-top">
              <div>
                <h3>${week.label}</h3>
                <p class="helper">${formatShort(week.start)}–${formatShort(week.end)}</p>
              </div>
              <span class="report-pill">${week.adherence}%</span>
            </div>
            <p><strong>${week.complete}</strong> días con plan completo</p>
            <p class="helper">${week.registered.length}/7 días registrados · ejercicio ${week.exercise}/${exerciseGoal}${week.exercise >= exerciseGoal ? " ✓" : ""}</p>
            <div class="report-progress"><span style="width:${Math.min(100,week.adherence)}%"></span></div>
          </article>
        `).join("")}
      </div>
    </section>

    <section class="card tint-sage">
      <h2>Promedios por grupo</h2>
      <div class="report-group-list">
        ${categories.map(category => {
          const average = overall.stats[category.id].average;
          const goal = latestPlan.goals[category.id] || 0;
          const percentage = goal ? Math.min(100,(average / goal) * 100) : 100;

          return `
            <div class="report-group-row">
              <div>
                <strong>${category.emoji} ${category.label}</strong>
                <div class="helper">Meta ${goal}</div>
              </div>
              <div class="report-group-bar"><span style="width:${percentage}%"></span></div>
              <div><strong>${average.toFixed(1)}</strong> prom.</div>
            </div>
          `;
        }).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Observaciones automáticas</h2>
      ${observations.map(observation => `
        <div class="report-observation">${escapeHtml(observation)}</div>
      `).join("")}
    </section>

    <section class="card report-page-break">
      <h2>Registro diario</h2>
      <div class="report-day-grid">
        ${allDates.map(key => {
          const record = records[key];

          if(!record){
            return `
              <article class="report-day-card">
                <div class="report-day-head">
                  <div>
                    <h3>${formatShort(parseDate(key))}</h3>
                    <p class="helper">Sin registro</p>
                  </div>
                  <span class="report-day-status">Sin datos</span>
                </div>
              </article>
            `;
          }

          const plan = activePlanForDate(profile,key);
          const status = dayStatus(record.portions,plan.goals);

          return `
            <article class="report-day-card">
              <div class="report-day-head">
                <div>
                  <h3>${formatShort(parseDate(key))}</h3>
                  <p class="helper">Ejercicio: ${record.exercise ? "Sí" : "No"}</p>
                </div>
                <span class="report-day-status ${status.complete ? "complete" : ""}">
                  ${status.complete ? "Plan completo" : "Plan incompleto"}
                </span>
              </div>

              <div class="report-mini-grid">
                ${categories.map(category => `
                  <div class="report-mini">
                    <div>${category.emoji}</div>
                    <strong>${record.portions[category.id] || 0}/${plan.goals[category.id]}</strong>
                  </div>
                `).join("")}
              </div>
            </article>
          `;
        }).join("")}
      </div>
    </section>

    <section class="card">
      <h2>Comentarios del profesional</h2>
      <div class="report-comments"></div>
    </section>

    <div class="report-footer">Generado por Tina · Tu plan, un día a la vez.</div>
  `;
}
