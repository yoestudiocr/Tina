
import {categories, activePlanForDate, dayStatus} from "./utils.js";

export function buildDailyMessage(portions, goals, exercise){
  const status = dayStatus(portions, goals);
  const missing = [];
  if((portions.proteinas||0) < goals.proteinas) missing.push(`te faltan ${goals.proteinas-(portions.proteinas||0)} porciones de proteína`);
  if((portions.vegetales||0) < goals.vegetales) missing.push(`te faltan ${goals.vegetales-(portions.vegetales||0)} porciones de vegetales`);
  for(const id of ["frutas","harinas","grasas"]){
    if((portions[id]||0) < goals[id]){
      const label = categories.find(c=>c.id===id).label.toLowerCase();
      missing.push(`te faltan ${goals[id]-(portions[id]||0)} porciones de ${label}`);
    }
  }

  if(status.complete){
    return {
      tone:"good",
      text:exercise
        ? "Cumpliste todo tu plan y también hiciste ejercicio. Día redondito ✨"
        : "Cumpliste todo tu plan de alimentación 🌿"
    };
  }
  if(status.over.length){
    const labels = status.over.map(id=>categories.find(c=>c.id===id).label.toLowerCase());
    const extra = labels.length===1 ? labels[0] : `${labels.slice(0,-1).join(", ")} y ${labels.at(-1)}`;
    return {tone:"alert", text:`Hoy te pasaste en ${extra}. ${missing.length ? missing.join(". ")+"." : ""}`};
  }
  return {tone:"warning", text: missing.length ? `${missing.join(". ")}.` : "Tu registro de hoy está incompleto."};
}

export function buildWeeklySummary(records, profile, dates){
  const available = dates.filter(key=>records[key]);
  const exerciseCount = available.filter(key=>records[key].exercise).length;
  const target = profile.exerciseGoal;
  const completeDays = available.filter(key=>{
    const plan = activePlanForDate(profile,key);
    return dayStatus(records[key].portions,plan.goals).complete;
  }).length;

  const proteinDeficitDays = available.filter(key=>{
    const plan=activePlanForDate(profile,key);
    return (records[key].portions.proteinas||0) < plan.goals.proteinas;
  }).length;

  const excessCounts = Object.fromEntries(["frutas","harinas","grasas"].map(id=>[id,0]));
  available.forEach(key=>{
    const plan=activePlanForDate(profile,key);
    for(const id of Object.keys(excessCounts)){
      if((records[key].portions[id]||0)>plan.goals[id]) excessCounts[id]++;
    }
  });

  const sentences = [];
  sentences.push(`Registraste ${available.length} de 7 días y cumpliste todo el plan en ${completeDays}.`);
  sentences.push(`Ejercicio: ${exerciseCount}/${target}${exerciseCount>=target ? " ✅" : ""}.`);
  if(proteinDeficitDays) sentences.push(`Te faltó proteína en ${proteinDeficitDays} ${proteinDeficitDays===1?"día":"días"}.`);
  const excessParts = Object.entries(excessCounts).filter(([,n])=>n>0).map(([id,n])=>`${categories.find(c=>c.id===id).label.toLowerCase()} (${n})`);
  if(excessParts.length) sentences.push(`Excesos: ${excessParts.join(", ")}.`);
  else sentences.push("No hubo excesos en frutas, harinas ni grasas.");
  return sentences.join(" ");
}
