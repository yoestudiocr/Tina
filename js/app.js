
import {loadProfile,saveProfile,loadRecords,saveRecords,clearRecords} from "./storage.js";
import {categories,isoLocal,parseDate,addDays,formatShort,emptyPortions,activePlanForDate,dayStatus} from "./utils.js";
import {buildDailyMessage,buildWeeklySummary} from "./insights.js";
import {renderFourWeekReport} from "./report.js";

const $=id=>document.getElementById(id);
let profile=loadProfile();
let records=loadRecords();
let current=emptyPortions();
let exercise=false;
let editing=false;

const defaults={proteinas:14,vegetales:2,frutas:3,harinas:1,grasas:1};

function toast(text){
  const el=$("toast");
  el.textContent=text;
  el.classList.add("show");
  clearTimeout(toast.timer);
  toast.timer=setTimeout(()=>el.classList.remove("show"),1800);
}

function hideAllScreens(){
  $("setupScreen").classList.add("hidden");
  $("mainScreen").classList.add("hidden");
  $("reportScreen").classList.add("hidden");
}

function showSetup(isEdit=false){
  editing=isEdit;
  hideAllScreens();
  $("setupScreen").classList.remove("hidden");
  $("profileName").value=profile?.name||"";

  const effectiveDate = $("selectedDate").value || isoLocal();
  const active=profile ? activePlanForDate(profile,effectiveDate) : {goals:defaults};

  categories.forEach(c=>{
    $("goal"+capitalize(c.id)).value=active.goals[c.id] ?? defaults[c.id];
  });

  $("exerciseGoal").value=String(profile?.exerciseGoal ?? 3);
  $("saveProfileButton").textContent=isEdit ? "Guardar nuevo plan" : "Guardar mi plan";
  $("cancelPlanButton").classList.toggle("hidden",!isEdit);

  $("profileSectionTitle").textContent=isEdit ? "Editar plan nutricional" : "Tu información";
  $("profileSectionHelper").textContent=isEdit
    ? `Los cambios se aplicarán a partir del ${effectiveDate} y no modificarán tu historial anterior.`
    : "Todo se guarda únicamente en este dispositivo.";
}

function showMain(){
  hideAllScreens();
  $("mainScreen").classList.remove("hidden");
  $("greeting").textContent=`Hola, ${profile.name} 🌷`;
  $("selectedDate").value=$("selectedDate").value||isoLocal();
  loadDay();
}

function showReport(){
  $("reportContent").innerHTML = renderFourWeekReport(
    records,
    profile,
    $("selectedDate").value
  );
  hideAllScreens();
  $("reportScreen").classList.remove("hidden");
  window.scrollTo({top:0,behavior:"instant"});
}

function capitalize(s){return s.charAt(0).toUpperCase()+s.slice(1)}

function savePlanFromForm(){
  const name=$("profileName").value.trim();
  if(!name)return toast("Escribe tu nombre");
  const goals={};
  for(const c of categories){
    const value=parseInt($("goal"+capitalize(c.id)).value,10);
    if(!Number.isFinite(value)||value<0)return toast("Revisa las metas del plan");
    goals[c.id]=value;
  }
  const exerciseGoal=parseInt($("exerciseGoal").value,10);

  if(!profile){
    profile={
      name,
      exerciseGoal,
      plans:[{id:crypto.randomUUID(),effectiveDate:isoLocal(),goals}]
    };
  }else{
    profile.name=name;
    profile.exerciseGoal=exerciseGoal;
    if(editing){
      profile.plans.push({
        id:crypto.randomUUID(),
        effectiveDate:$("selectedDate").value||isoLocal(),
        goals
      });
    }else{
      profile.plans=[{id:crypto.randomUUID(),effectiveDate:isoLocal(),goals}];
    }
  }
  saveProfile(profile);
  showMain();
  toast(editing?"Nuevo plan guardado":"Plan guardado");
}

function loadDay(){
  const key=$("selectedDate").value;
  const rec=records[key];
  current=rec?{...rec.portions}:emptyPortions();
  exercise=rec?!!rec.exercise:false;
  render();
}

function autosave(){
  const key=$("selectedDate").value;
  const plan=activePlanForDate(profile,key);
  records[key]={
    portions:{...current},
    exercise,
    planId:plan.id,
    goals:{...plan.goals},
    updatedAt:new Date().toISOString()
  };
  saveRecords(records);
}

function categoryState(c,goal,value){
  if(c.mode==="minimum"){
    if(value<goal)return {text:`Faltan ${goal-value}`,fill:goal?value/goal*100:100,cls:""};
    if(value===goal)return {text:"Meta cumplida ✓",fill:100,cls:"safe"};
    return {text:`+${value-goal} sobre la meta · seguro`,fill:100,cls:"safe"};
  }
  if(value<goal)return {text:`Faltan ${goal-value}`,fill:goal?value/goal*100:100,cls:""};
  if(value===goal)return {text:"Meta cumplida ✓",fill:100,cls:"safe"};
  return {text:`+${value-goal} sobre la meta`,fill:100,cls:"over"};
}

function renderPortions(){
  const plan=activePlanForDate(profile,$("selectedDate").value);
  $("portionList").innerHTML=categories.map(c=>{
    const value=current[c.id]||0,goal=plan.goals[c.id],state=categoryState(c,goal,value);
    return `<div class="portion-row">
      <div>
        <div class="portion-title">${c.emoji} ${c.label}</div>
        <div class="portion-status">${state.text}</div>
      </div>
      <div class="controls">
        <button class="counter minus" data-id="${c.id}" type="button" aria-label="Restar ${c.label}">−</button>
        <div class="value">${value}/${goal}</div>
        <button class="counter plus" data-id="${c.id}" type="button" aria-label="Agregar ${c.label}">+</button>
      </div>
      <div class="bar"><div class="fill ${state.cls}" style="width:${Math.min(100,state.fill)}%"></div></div>
    </div>`;
  }).join("");

  document.querySelectorAll(".plus").forEach(b=>b.addEventListener("click",()=>changeValue(b.dataset.id,1)));
  document.querySelectorAll(".minus").forEach(b=>b.addEventListener("click",()=>changeValue(b.dataset.id,-1)));
}

function changeValue(id,delta){
  current[id]=Math.max(0,(current[id]||0)+delta);
  autosave();
  render();
}

function renderExercise(){
  $("exerciseToggle").classList.toggle("active",exercise);
  $("exerciseToggle").setAttribute("aria-pressed",String(exercise));
  $("exerciseLabel").textContent=exercise?"Sí realizado 🏃🏻‍♀️":"No realizado";
}

function renderDaily(){
  const plan=activePlanForDate(profile,$("selectedDate").value);
  const message=buildDailyMessage(current,plan.goals,exercise);
  const box=$("dailyMessage");
  box.className=`status-card ${message.tone}`;
  box.textContent=message.text;
}

function weekDatesEndingAt(dateKey){
  const end=parseDate(dateKey);
  const start=addDays(end,-6);
  return Array.from({length:7},(_,i)=>isoLocal(addDays(start,i)));
}

function renderWeek(){
  const dates=weekDatesEndingAt($("selectedDate").value);
  $("weekRange").textContent=`${formatShort(parseDate(dates[0]))} al ${formatShort(parseDate(dates[6]))}`;
  const completeCount=dates.filter(key=>{
    if(!records[key])return false;
    const plan=activePlanForDate(profile,key);
    return dayStatus(records[key].portions,plan.goals).complete;
  }).length;
  $("weeklyPlanCount").textContent=`${completeCount}/7 completos`;

  $("weekGrid").innerHTML=dates.map(key=>{
    const date=parseDate(key);
    const rec=records[key];
    let cls="empty",symbol="—";
    if(rec){
      const plan=activePlanForDate(profile,key);
      const status=dayStatus(rec.portions,plan.goals);
      cls=status.complete?"complete":status.over.length?"alert":"partial";
      symbol=status.complete?"✓":status.over.length?"!":"•";
    }
    return `<div class="day-cell">
      <div class="day-label">${date.toLocaleDateString("es-CR",{weekday:"short"}).slice(0,2)}</div>
      <div class="day-dot ${cls}" title="${key}">${symbol}</div>
    </div>`;
  }).join("");

  $("weeklySummary").textContent=buildWeeklySummary(records,profile,dates);
}

function render(){
  renderPortions();
  renderExercise();
  renderDaily();
  renderWeek();
}

$("saveProfileButton").addEventListener("click",savePlanFromForm);
$("selectedDate").addEventListener("change",loadDay);
$("exerciseToggle").addEventListener("click",()=>{
  exercise=!exercise;
  autosave();
  render();
});
$("editPlanButton").addEventListener("click",()=>showSetup(true));

$("cancelPlanButton").addEventListener("click",()=>{
  editing=false;
  showMain();
  window.scrollTo({top:0,behavior:"instant"});
});
$("downloadReportButton").addEventListener("click",()=>{
  try{showReport()}
  catch(error){toast(error.message)}
});

$("backFromReportButton").addEventListener("click",()=>{
  showMain();
  window.scrollTo({top:0,behavior:"instant"});
});

$("printReportButton").addEventListener("click",()=>window.print());
$("clearHistoryButton").addEventListener("click",()=>{
  if(confirm("¿Seguro que quieres borrar todo el historial de este dispositivo?")){
    records={};
    clearRecords();
    loadDay();
    toast("Historial borrado");
  }
});

if("serviceWorker" in navigator){
  window.addEventListener("load",()=>navigator.serviceWorker.register("./service-worker.js"));
}

$("selectedDate").value=isoLocal();
if(profile) showMain();
else showSetup(false);
