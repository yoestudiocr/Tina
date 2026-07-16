
const KEYS = {
  profile: "tina.profile.v1",
  records: "tina.records.v1"
};

export function loadProfile(){
  try{return JSON.parse(localStorage.getItem(KEYS.profile) || "null")}
  catch{return null}
}
export function saveProfile(profile){
  localStorage.setItem(KEYS.profile, JSON.stringify(profile));
}
export function loadRecords(){
  try{return JSON.parse(localStorage.getItem(KEYS.records) || "{}")}
  catch{return {}}
}
export function saveRecords(records){
  localStorage.setItem(KEYS.records, JSON.stringify(records));
}
export function clearRecords(){
  localStorage.removeItem(KEYS.records);
}
