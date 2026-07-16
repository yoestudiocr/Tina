
export const categories = [
  {id:"proteinas", label:"Proteínas", emoji:"🍳", mode:"minimum"},
  {id:"vegetales", label:"Vegetales", emoji:"🥦", mode:"minimum"},
  {id:"frutas", label:"Frutas", emoji:"🍓", mode:"exact"},
  {id:"harinas", label:"Harinas", emoji:"🍞", mode:"exact"},
  {id:"grasas", label:"Grasas", emoji:"🥑", mode:"exact"}
];

export function isoLocal(date = new Date()){
  const y = date.getFullYear();
  const m = String(date.getMonth()+1).padStart(2,"0");
  const d = String(date.getDate()).padStart(2,"0");
  return `${y}-${m}-${d}`;
}
export function parseDate(key){
  const [y,m,d] = key.split("-").map(Number);
  return new Date(y,m-1,d);
}
export function addDays(date, amount){
  const copy = new Date(date);
  copy.setDate(copy.getDate()+amount);
  return copy;
}
export function formatDate(date){
  return date.toLocaleDateString("es-CR",{day:"numeric",month:"long",year:"numeric"});
}
export function formatShort(date){
  return date.toLocaleDateString("es-CR",{day:"numeric",month:"short"});
}
export function emptyPortions(){
  return Object.fromEntries(categories.map(c=>[c.id,0]));
}
export function activePlanForDate(profile, dateKey){
  const plans = [...profile.plans].sort((a,b)=>a.effectiveDate.localeCompare(b.effectiveDate));
  let active = plans[0];
  for(const plan of plans){
    if(plan.effectiveDate <= dateKey) active = plan;
  }
  return active;
}
export function dayStatus(portions, goals){
  const proteinOk = (portions.proteinas||0) >= goals.proteinas;
  const vegOk = (portions.vegetales||0) >= goals.vegetales;
  const fruitExact = (portions.frutas||0) === goals.frutas;
  const carbsExact = (portions.harinas||0) === goals.harinas;
  const fatsExact = (portions.grasas||0) === goals.grasas;

  const over = ["frutas","harinas","grasas"].filter(id => (portions[id]||0) > goals[id]);
  const complete = proteinOk && vegOk && fruitExact && carbsExact && fatsExact;

  return {complete, over};
}
