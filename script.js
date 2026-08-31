/* ===================== データ層 ===================== */
const STORAGE_FOLDERS = "folders";
const STORAGE_CARDS = "cards";

let folders = [];
let cards = [];
let storageReady = false;

async function loadData(){
  try{
    const f = await window.storage.get(STORAGE_FOLDERS, false);
    folders = f ? JSON.parse(f.value) : [];
  }catch(e){ folders = []; }
  try{
    const c = await window.storage.get(STORAGE_CARDS, false);
    cards = c ? JSON.parse(c.value) : [];
  }catch(e){ cards = []; }
  storageReady = true;
}
async function saveFolders(){
  try{ await window.storage.set(STORAGE_FOLDERS, JSON.stringify(folders), false); }
  catch(e){ showToast("保存に失敗しました"); }
}
async function saveCards(){
  try{ await window.storage.set(STORAGE_CARDS, JSON.stringify(cards), false); }
  catch(e){ showToast("保存に失敗しました"); }
}

function uid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,7); }

/* ===================== 地図データ(簡易版) =====================
   実際の都道府県/国境ポリゴンではなく、MVP実装として簡略化した地域ブロックです。
   本番投入前に正確な地理データへの差し替えが必要です。 */

const JAPAN_REGIONS = [
  {id:"hokkaido", name:"北海道", x:200, y:20, w:90, h:60},
  {id:"tohoku", name:"東北", x:210, y:85, w:70, h:60},
  {id:"kanto", name:"関東", x:220, y:150, w:60, h:45},
  {id:"chubu", name:"中部", x:160, y:150, w:60, h:50},
  {id:"kinki", name:"近畿", x:110, y:170, w:55, h:45},
  {id:"chugoku", name:"中国", x:55, y:165, w:55, h:40},
  {id:"shikoku", name:"四国", x:95, y:215, w:45, h:30},
  {id:"kyushu", name:"九州", x:20, y:210, w:55, h:55},
];

const WORLD_ERAS = [
  {id:"ancient", label:"古代", yearMax:500},
  {id:"medieval", label:"中世", yearMax:1500},
  {id:"early_modern", label:"近世", yearMax:1789},
  {id:"modern", label:"近代", yearMax:1945},
  {id:"contemporary", label:"現代", yearMax:Infinity},
];
function eraForYear(year){
  if(year===null || year===undefined || isNaN(year)) return WORLD_ERAS[WORLD_ERAS.length-1];
  for(const e of WORLD_ERAS){ if(year<=e.yearMax) return e; }
  return WORLD_ERAS[WORLD_ERAS.length-1];
}
// 時代ごとに簡略化した地域ブロック(本来は時代で境界が変化するが、MVPでは代表的な大陸ブロックの名称のみ時代に応じて一部変更)
const WORLD_REGIONS_BY_ERA = {
  ancient: [
    {id:"egypt_mesopotamia", name:"エジプト・メソポタミア", x:180,y:90,w:70,h:40},
    {id:"greece_rome", name:"地中海世界", x:120,y:70,w:60,h:40},
    {id:"persia_india", name:"ペルシア・インド", x:250,y:90,w:70,h:50},
    {id:"china", name:"中国", x:330,y:70,w:60,h:50},
    {id:"other", name:"その他地域", x:40,y:120,w:60,h:50},
  ],
  medieval: [
    {id:"europe", name:"ヨーロッパ", x:120,y:50,w:70,h:50},
    {id:"islamic", name:"イスラーム世界", x:190,y:90,w:80,h:45},
    {id:"india", name:"インド", x:270,y:110,w:50,h:45},
    {id:"china_medieval", name:"中国", x:330,y:70,w:60,h:50},
    {id:"other_m", name:"その他地域", x:40,y:120,w:60,h:50},
  ],
  early_modern: [
    {id:"europe_em", name:"ヨーロッパ", x:120,y:50,w:70,h:50},
    {id:"americas", name:"南北アメリカ", x:20,y:60,w:60,h:80},
    {id:"ottoman", name:"オスマン帝国", x:190,y:80,w:70,h:40},
    {id:"asia_em", name:"アジア", x:280,y:80,w:110,h:60},
    {id:"other_em", name:"その他地域", x:40,y:150,w:50,h:40},
  ],
  modern: [
    {id:"europe_mod", name:"ヨーロッパ", x:120,y:50,w:70,h:50},
    {id:"americas_mod", name:"南北アメリカ", x:20,y:60,w:60,h:80},
    {id:"africa_mod", name:"アフリカ", x:130,y:110,w:60,h:70},
    {id:"asia_mod", name:"アジア", x:280,y:80,w:110,h:60},
    {id:"oceania_mod", name:"オセアニア", x:330,y:150,w:60,h:40},
  ],
  contemporary: [
    {id:"europe_c", name:"ヨーロッパ", x:120,y:50,w:70,h:50},
    {id:"americas_c", name:"南北アメリカ", x:20,y:60,w:60,h:80},
    {id:"africa_c", name:"アフリカ", x:130,y:110,w:60,h:70},
    {id:"asia_c", name:"アジア", x:280,y:80,w:110,h:60},
    {id:"oceania_c", name:"オセアニア", x:330,y:150,w:60,h:40},
  ],
};

/* ===================== DNDNロジック(純粋関数) ===================== */
const ELEMENTS = ["where","year","who","what"];
const ELEMENT_LABEL = {where:"どこで", year:"何年", who:"だれが", what:"何をした"};

function computeDisplay(selected){
  // selected: Set of element keys that the user wants to memorize (= will be hidden)
  const hidden = ELEMENTS.filter(e=>selected.has(e));
  const visible = ELEMENTS.filter(e=>!selected.has(e));
  const needsMap = selected.has("where");
  return {hidden, visible, needsMap};
}

/* ===================== ルーティング ===================== */
let route = {name:"home", params:{}};
let uiState = {}; // 一時的なUI状態(暗記セッション、フォーム入力中身など)

function navigate(name, params={}){
  route = {name, params};
  uiState = {};
  render();
}

function showToast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"), 1800);
}

/* ===================== レンダリング ===================== */
function render(){
  const app = document.getElementById("app");
  app.innerHTML = "";
  const header = renderHeader();
  const main = document.createElement("main");
  app.appendChild(header);
  app.appendChild(main);

  switch(route.name){
    case "home": renderHome(main); break;
    case "folder": renderFolder(main); break;
    case "cardForm": renderCardForm(main); break;
    case "memorizeSetup": renderMemorizeSetup(main); break;
    case "memorize": renderMemorize(main); break;
    case "table": renderTable(main); break;
    default: renderHome(main);
  }
}

function renderHeader(){
  const header = document.createElement("header");
  header.className = "top";
  const titles = {
    home: null,
    folder: "問題一覧",
    cardForm: uiState.editingCardId ? "問題を編集" : "問題を追加",
    memorizeSetup: "暗記の設定",
    memorize: "暗記中",
    table: "表で確認",
  };
  const brand = document.createElement("div");
  if(route.name==="home"){
    brand.className="brand";
    brand.innerHTML = `DaNDaN暗記帳<small>どこで・何年・だれが・何をした</small>`;
    header.appendChild(brand);
  }else{
    const back = document.createElement("button");
    back.className="back-btn";
    back.textContent = "← もどる";
    back.onclick = ()=>{
      if(route.name==="folder") navigate("home");
      else navigate("folder", {folderId: route.params.folderId});
    };
    header.appendChild(back);
    const t = document.createElement("div");
    t.className="brand";
    t.style.fontSize="15px";
    t.textContent = titles[route.name] || "";
    header.appendChild(t);
    const spacer = document.createElement("div");
    spacer.style.width="60px";
    header.appendChild(spacer);
  }
  return header;
}

/* ---------- ホーム画面 ---------- */
function renderHome(main){
  if(!uiState.subject) uiState.subject = "japanese_history";

  const tabs = document.createElement("div");
  tabs.className="tabs";
  [["japanese_history","日本史"],["world_history","世界史"]].forEach(([key,label])=>{
    const tab = document.createElement("button");
    tab.className = "tab"+(uiState.subject===key?" active":"");
    tab.textContent = label;
    tab.onclick = ()=>{ uiState.subject = key; render(); };
    tabs.appendChild(tab);
  });
  main.appendChild(tabs);

  const list = folders.filter(f=>f.subject===uiState.subject);

  if(folders.length===0){
    const empty = document.createElement("div");
    empty.className="empty-state";
    empty.innerHTML = `<div class="mark">帳</div><p>まだ暗記帳がありません。<br>最初のフォルダを作ってみましょう。</p>`;
    const btn = document.createElement("button");
    btn.className="btn btn-primary";
    btn.textContent="＋ 最初のフォルダを作成";
    btn.onclick = ()=>createFolderFlow(uiState.subject);
    empty.appendChild(btn);
    main.appendChild(empty);
    return;
  }

  const grid = document.createElement("div");
  grid.className="folder-grid";
  list.forEach(f=>{
    const card = document.createElement("div");
    card.className="folder-card";
    const count = cards.filter(c=>c.folderId===f.id).length;
    card.innerHTML = `<div class="fname">${escapeHtml(f.name)}</div><div class="fcount">${count}問</div>`;
    card.onclick = ()=>navigate("folder", {folderId:f.id});
    grid.appendChild(card);
  });
  const newCard = document.createElement("div");
  newCard.className="new-folder-card";
  newCard.textContent="＋ 新規フォルダ";
  newCard.onclick = ()=>createFolderFlow(uiState.subject);
  grid.appendChild(newCard);
  main.appendChild(grid);

  if(list.length===0 && folders.length>0){
    const note = document.createElement("p");
    note.style.color="var(--ink-soft)";
    note.style.fontSize="13px";
    note.textContent="この科目のフォルダはまだありません。";
    main.insertBefore(note, grid);
  }
}

function createFolderFlow(subject){
  openModal({
    title:"新規フォルダ",
    fields:[{key:"name", label:"フォルダ名", placeholder:"例:鎌倉時代まとめ"}],
    confirmLabel:"作成する",
    onConfirm:(values)=>{
      const name = (values.name||"").trim();
      if(!name){ showToast("フォルダ名を入力してください"); return false; }
      const folder = {id:uid(), name, subject, createdAt:new Date().toISOString()};
      folders.push(folder);
      saveFolders();
      navigate("folder", {folderId:folder.id});
      return true;
    }
  });
}

/* ===================== 汎用モーダル(prompt/confirmの代替) =====================
   サンドボックス化された実行環境では window.prompt() / window.confirm() が
   ブロックされ無反応になることがあるため、独自のモーダルUIで代替する。 */
function openModal({title, message, fields=[], confirmLabel="OK", cancelLabel="キャンセル", onConfirm, danger=false}){
  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(34,48,60,0.45);display:flex;align-items:center;justify-content:center;z-index:100;padding:20px;";
  const box = document.createElement("div");
  box.style.cssText = "background:var(--paper);border:2px solid var(--ink);max-width:360px;width:100%;padding:22px 20px;";
  overlay.appendChild(box);

  const h = document.createElement("h3");
  h.className="serif";
  h.style.cssText="margin:0 0 14px;font-size:17px;color:var(--indigo-deep);";
  h.textContent = title;
  box.appendChild(h);

  if(message){
    const p = document.createElement("p");
    p.style.cssText="font-size:14px;line-height:1.6;margin:0 0 16px;";
    p.textContent = message;
    box.appendChild(p);
  }

  const values = {};
  const inputs = [];
  fields.forEach(f=>{
    const field = document.createElement("div");
    field.className="field";
    field.style.marginBottom="14px";
    const label = document.createElement("label");
    label.textContent = f.label;
    field.appendChild(label);
    const input = document.createElement("input");
    input.type="text";
    input.placeholder = f.placeholder||"";
    input.value = f.initial||"";
    field.appendChild(input);
    box.appendChild(field);
    inputs.push({key:f.key, el:input});
  });

  const btnRow = document.createElement("div");
  btnRow.style.cssText="display:flex;gap:10px;justify-content:flex-end;margin-top:6px;";
  const cancelBtn = document.createElement("button");
  cancelBtn.className="btn";
  cancelBtn.textContent = cancelLabel;
  cancelBtn.onclick = ()=>document.body.removeChild(overlay);
  btnRow.appendChild(cancelBtn);

  const okBtn = document.createElement("button");
  okBtn.className = danger ? "btn btn-danger" : "btn btn-primary";
  okBtn.textContent = confirmLabel;
  okBtn.onclick = ()=>{
    inputs.forEach(i=>values[i.key]=i.el.value);
    const result = onConfirm(values);
    if(result !== false) document.body.removeChild(overlay);
  };
  btnRow.appendChild(okBtn);
  box.appendChild(btnRow);

  document.body.appendChild(overlay);
  if(inputs[0]) inputs[0].el.focus();
}

/* ---------- フォルダ詳細 ---------- */
function renderFolder(main){
  const folder = folders.find(f=>f.id===route.params.folderId);
  if(!folder){ navigate("home"); return; }
  const folderCards = cards.filter(c=>c.folderId===folder.id).sort((a,b)=>a.order-b.order);

  const badge = document.createElement("div");
  badge.className="subject-badge";
  badge.textContent = folder.subject==="japanese_history" ? "日本史" : "世界史";
  main.appendChild(badge);

  const h = document.createElement("h2");
  h.className="section-title";
  h.textContent = folder.name;
  main.appendChild(h);

  const actionRow = document.createElement("div");
  actionRow.className="action-row";
  const addBtn = document.createElement("button");
  addBtn.className="btn";
  addBtn.textContent="＋ 問題を追加";
  addBtn.onclick = ()=>navigate("cardForm", {folderId:folder.id});
  actionRow.appendChild(addBtn);

  const memoBtn = document.createElement("button");
  memoBtn.className="btn btn-primary";
  memoBtn.textContent="暗記開始";
  memoBtn.disabled = folderCards.length===0;
  memoBtn.onclick = ()=>navigate("memorizeSetup", {folderId:folder.id});
  actionRow.appendChild(memoBtn);

  const tableBtn = document.createElement("button");
  tableBtn.className="btn";
  tableBtn.textContent="表で確認";
  tableBtn.disabled = folderCards.length===0;
  tableBtn.onclick = ()=>navigate("table", {folderId:folder.id});
  actionRow.appendChild(tableBtn);

  main.appendChild(actionRow);

  if(folderCards.length===0){
    const empty = document.createElement("div");
    empty.className="empty-state";
    empty.innerHTML = `<div class="mark">問</div><p>このフォルダにはまだ問題がありません。<br>DNDNの4要素を入力して追加しましょう。</p>`;
    main.appendChild(empty);
    return;
  }

  const ul = document.createElement("ul");
  ul.className="card-list";
  folderCards.forEach(c=>{
    const li = document.createElement("li");
    li.className="card-item";
    const summary = document.createElement("div");
    summary.className="summary";
    summary.innerHTML = `<span class="tag">${c.year!==null?c.year+"年":"年不明"}</span>${escapeHtml(c.where||"(場所未入力)")} / ${escapeHtml(c.who||"(未入力)")} / ${escapeHtml(c.what||"(未入力)")}`;
    li.appendChild(summary);
    const ops = document.createElement("div");
    ops.className="ops";
    const editBtn = document.createElement("button");
    editBtn.className="btn-text";
    editBtn.textContent="編集";
    editBtn.onclick = ()=>navigate("cardForm", {folderId:folder.id, cardId:c.id});
    ops.appendChild(editBtn);
    const delBtn = document.createElement("button");
    delBtn.className="btn-text";
    delBtn.style.color="var(--hanko)";
    delBtn.textContent="削除";
    delBtn.onclick = ()=>{
      openModal({
        title:"問題を削除しますか?",
        message:"この操作は取り消せません。",
        confirmLabel:"削除する",
        danger:true,
        onConfirm:()=>{
          cards = cards.filter(x=>x.id!==c.id);
          saveCards();
          render();
        }
      });
    };
    ops.appendChild(delBtn);
    li.appendChild(ops);
    ul.appendChild(li);
  });
  main.appendChild(ul);
}

/* ---------- 問題作成・編集フォーム ---------- */
function renderCardForm(main){
  const folder = folders.find(f=>f.id===route.params.folderId);
  if(!folder){ navigate("home"); return; }
  const editing = route.params.cardId ? cards.find(c=>c.id===route.params.cardId) : null;

  if(!uiState.form){
    uiState.form = editing ? {...editing} : {
      where:"", whereRegion:"", year:"", who:"", what:""
    };
  }
  const form = uiState.form;

  const wrap = document.createElement("div");

  const whereField = document.createElement("div");
  whereField.className="field";
  whereField.innerHTML = `<label>どこで</label>`;
  const whereInput = document.createElement("input");
  whereInput.type="text"; whereInput.value=form.where; whereInput.placeholder="例:鎌倉";
  whereInput.oninput = e=>form.where=e.target.value;
  whereField.appendChild(whereInput);
  const hint = document.createElement("div");
  hint.className="hint";
  hint.textContent="※ここに入力した文言が暗記時にそのまま表示されます。";
  whereField.appendChild(hint);
  wrap.appendChild(whereField);

  // 地図判定用プルダウン(裏データ)
  const regionField = document.createElement("div");
  regionField.className="field";
  regionField.innerHTML = `<label>地図タップ用の地域(表示はされません)</label>`;
  const regionSelect = document.createElement("select");
  const regions = folder.subject==="japanese_history" ? JAPAN_REGIONS : allWorldRegionsFlat();
  const noneOpt = document.createElement("option");
  noneOpt.value=""; noneOpt.textContent="選択してください";
  regionSelect.appendChild(noneOpt);
  regions.forEach(r=>{
    const opt = document.createElement("option");
    opt.value=r.id; opt.textContent=r.name;
    if(form.whereRegion===r.id) opt.selected=true;
    regionSelect.appendChild(opt);
  });
  regionSelect.onchange = e=>form.whereRegion=e.target.value;
  regionField.appendChild(regionSelect);
  const regionHint = document.createElement("div");
  regionHint.className="hint";
  regionHint.textContent = folder.subject==="world_history"
    ? "※世界史は「何年」から時代を自動判定し、該当時代の地図上の地域として扱われます。"
    : "※白地図タップ時の正解判定範囲(都道府県ブロック)を選びます。";
  regionField.appendChild(regionHint);
  wrap.appendChild(regionField);

  const row = document.createElement("div");
  row.className="field-row";
  const yearField = document.createElement("div");
  yearField.className="field";
  yearField.innerHTML = `<label>何年(西暦)</label>`;
  const yearInput = document.createElement("input");
  yearInput.type="number"; yearInput.value=form.year; yearInput.placeholder="例:1192";
  yearInput.oninput = e=>form.year=e.target.value;
  yearField.appendChild(yearInput);
  row.appendChild(yearField);

  const whoField = document.createElement("div");
  whoField.className="field";
  whoField.innerHTML = `<label>だれが</label>`;
  const whoInput = document.createElement("input");
  whoInput.type="text"; whoInput.value=form.who; whoInput.placeholder="例:源頼朝";
  whoInput.oninput = e=>form.who=e.target.value;
  whoField.appendChild(whoInput);
  row.appendChild(whoField);
  wrap.appendChild(row);

  const whatField = document.createElement("div");
  whatField.className="field";
  whatField.innerHTML = `<label>何をした</label>`;
  const whatInput = document.createElement("textarea");
  whatInput.value=form.what; whatInput.placeholder="例:征夷大将軍に任命され、鎌倉幕府を開いた";
  whatInput.maxLength=200;
  whatInput.oninput = e=>form.what=e.target.value;
  whatField.appendChild(whatInput);
  wrap.appendChild(whatField);

  const actionRow = document.createElement("div");
  actionRow.className="action-row";
  const saveBtn = document.createElement("button");
  saveBtn.className="btn btn-primary";
  saveBtn.textContent = editing ? "更新する" : "追加する";
  saveBtn.onclick = ()=>{
    const yearNum = form.year===""||form.year===null||form.year===undefined ? null : parseInt(form.year,10);
    if(editing){
      Object.assign(editing, {
        where:form.where, whereRegion:form.whereRegion, year:isNaN(yearNum)?null:yearNum,
        who:form.who, what:form.what,
      });
    }else{
      const maxOrder = cards.filter(c=>c.folderId===folder.id).reduce((m,c)=>Math.max(m,c.order),0);
      cards.push({
        id:uid(), folderId:folder.id,
        where:form.where, whereRegion:form.whereRegion, year:isNaN(yearNum)?null:yearNum,
        who:form.who, what:form.what,
        order:maxOrder+1, createdAt:new Date().toISOString(),
      });
    }
    saveCards();
    navigate("folder", {folderId:folder.id});
  };
  actionRow.appendChild(saveBtn);
  const cancelBtn = document.createElement("button");
  cancelBtn.className="btn";
  cancelBtn.textContent="キャンセル";
  cancelBtn.onclick = ()=>navigate("folder", {folderId:folder.id});
  actionRow.appendChild(cancelBtn);
  wrap.appendChild(actionRow);

  main.appendChild(wrap);
}

function allWorldRegionsFlat(){
  // プルダウン表示用に全時代の地域をまとめて出す(重複名は許容、id は時代付きなので一意)
  const seen = new Map();
  Object.values(WORLD_REGIONS_BY_ERA).forEach(list=>{
    list.forEach(r=>{ if(!seen.has(r.name)) seen.set(r.name, r); });
  });
  return Array.from(seen.values());
}

/* ---------- 暗記設定画面 ---------- */
function renderMemorizeSetup(main){
  const folder = folders.find(f=>f.id===route.params.folderId);
  if(!folder){ navigate("home"); return; }

  if(!uiState.selected) uiState.selected = new Set();
  if(!uiState.order) uiState.order = "year_asc";

  const h = document.createElement("h3");
  h.className="section-title";
  h.textContent="覚えたい要素を選んでください(最大3つ)";
  main.appendChild(h);

  const group = document.createElement("div");
  group.className="check-group";
  ELEMENTS.forEach(key=>{
    const row = document.createElement("div");
    const isChecked = uiState.selected.has(key);
    const wouldExceed = !isChecked && uiState.selected.size>=3;
    row.className="check-row"+(wouldExceed?" disabled":"");
    const cb = document.createElement("input");
    cb.type="checkbox"; cb.checked=isChecked; cb.disabled=wouldExceed;
    cb.id="chk-"+key;
    cb.onchange = ()=>{
      if(cb.checked) uiState.selected.add(key); else uiState.selected.delete(key);
      render();
    };
    row.appendChild(cb);
    const label = document.createElement("label");
    label.htmlFor="chk-"+key;
    label.textContent=ELEMENT_LABEL[key];
    row.appendChild(label);
    group.appendChild(row);
  });
  main.appendChild(group);
  if(uiState.selected.size>=3){
    const note = document.createElement("div");
    note.className="hint";
    note.style.marginTop="6px";
    note.textContent="※4要素すべてを同時に隠すことはできません(最大3つまで)。";
    main.appendChild(note);
  }
  if(uiState.selected.size===0){
    const note = document.createElement("div");
    note.className="hint";
    note.style.marginTop="6px";
    note.textContent="※何も選ばない場合は、すべて表示した状態で内容を確認できます。";
    main.appendChild(note);
  }

  const h2 = document.createElement("h3");
  h2.className="section-title";
  h2.style.marginTop="26px";
  h2.textContent="出題順";
  main.appendChild(h2);

  const radioGroup = document.createElement("div");
  radioGroup.className="radio-group";
  [["year_asc","年号順(昇順)"],["year_desc","年号順(降順)"],["random","ランダム"]].forEach(([key,label])=>{
    const chip = document.createElement("div");
    chip.className="radio-chip"+(uiState.order===key?" selected":"");
    chip.textContent=label;
    chip.onclick = ()=>{ uiState.order=key; render(); };
    radioGroup.appendChild(chip);
  });
  main.appendChild(radioGroup);

  const actionRow = document.createElement("div");
  actionRow.className="action-row";
  actionRow.style.marginTop="30px";
  const startBtn = document.createElement("button");
  startBtn.className="btn btn-primary";
  startBtn.textContent="この設定で暗記を始める";
  startBtn.onclick = ()=>{
    navigate("memorize", {folderId:folder.id, selected:Array.from(uiState.selected), order:uiState.order});
  };
  actionRow.appendChild(startBtn);
  main.appendChild(actionRow);
}

/* ---------- 暗記実行画面 ---------- */
function renderMemorize(main){
  const folder = folders.find(f=>f.id===route.params.folderId);
  if(!folder){ navigate("home"); return; }
  let folderCards = cards.filter(c=>c.folderId===folder.id);

  if(!uiState.deck){
    const order = route.params.order;
    let deck = [...folderCards];
    if(order==="year_asc"){
      deck = stableSortByYear(deck, true);
    }else if(order==="year_desc"){
      deck = stableSortByYear(deck, false);
    }else{
      deck = shuffle(deck);
    }
    uiState.deck = deck;
    uiState.index = 0;
    uiState.revealed = new Set(); // どのフィールドが開示済みか(現在のカードにつき)
    uiState.mapRevealed = false;
  }

  if(uiState.deck.length===0){
    navigate("folder", {folderId:folder.id});
    return;
  }

  const card = uiState.deck[uiState.index];
  const selectedSet = new Set(route.params.selected);
  const {hidden, visible, needsMap} = computeDisplay(selectedSet);

  const progress = document.createElement("div");
  progress.className="memo-progress";
  progress.textContent = `${uiState.index+1} / ${uiState.deck.length}`;
  main.appendChild(progress);

  const memoCard = document.createElement("div");
  memoCard.className="memo-card";

  if(needsMap){
    const mapWrap = document.createElement("div");
    mapWrap.className="map-wrap";
    mapWrap.appendChild(buildMap(card, uiState.mapRevealed, ()=>{
      uiState.mapRevealed = true;
      uiState.revealed.add("where");
      render();
    }, folder.subject));
    memoCard.appendChild(mapWrap);
  }

  ELEMENTS.forEach(key=>{
    if(key==="where" && needsMap) return; // 地図側で扱う
    const row = document.createElement("div");
    row.className="memo-field";
    const tag = document.createElement("div");
    tag.className="tag";
    tag.textContent = ELEMENT_LABEL[key];
    row.appendChild(tag);
    const val = document.createElement("div");
    val.className="value";
    const displayVal = formatFieldValue(key, card);
    if(hidden.includes(key)){
      const isRevealed = uiState.revealed.has(key);
      const slot = document.createElement("span");
      slot.className="hidden-slot"+(isRevealed?" revealed":"");
      slot.textContent = isRevealed ? displayVal : "";
      if(!isRevealed){
        slot.onclick = ()=>{ uiState.revealed.add(key); render(); };
      }
      val.appendChild(slot);
    }else{
      val.textContent = displayVal;
    }
    row.appendChild(val);
    memoCard.appendChild(row);
  });

  main.appendChild(memoCard);

  const nav = document.createElement("div");
  nav.className="memo-nav";
  const endBtn = document.createElement("button");
  endBtn.className="btn";
  endBtn.textContent="終了する";
  endBtn.onclick = ()=>navigate("folder", {folderId:folder.id});
  nav.appendChild(endBtn);

  const side = document.createElement("div");
  side.className="side";
  const revealAllBtn = document.createElement("button");
  revealAllBtn.className="btn";
  revealAllBtn.textContent="すべて表示";
  revealAllBtn.onclick = ()=>{
    hidden.forEach(k=>uiState.revealed.add(k));
    uiState.mapRevealed = true;
    render();
  };
  side.appendChild(revealAllBtn);

  const nextBtn = document.createElement("button");
  nextBtn.className="btn btn-primary";
  nextBtn.textContent = uiState.index < uiState.deck.length-1 ? "次へ" : "最後まで確認した";
  nextBtn.onclick = ()=>{
    if(uiState.index < uiState.deck.length-1){
      uiState.index += 1;
      uiState.revealed = new Set();
      uiState.mapRevealed = false;
      render();
    }else{
      showToast("この暗記帳は最後まで確認しました");
      navigate("folder", {folderId:folder.id});
    }
  };
  side.appendChild(nextBtn);
  nav.appendChild(side);
  main.appendChild(nav);
}

function formatFieldValue(key, card){
  if(key==="year") return card.year!==null && card.year!==undefined ? card.year+"年" : "(年号未入力)";
  if(key==="where") return card.where || "(未入力)";
  if(key==="who") return card.who || "(未入力)";
  if(key==="what") return card.what || "(未入力)";
  return "";
}

function stableSortByYear(deck, asc){
  return deck
    .map((c,i)=>({c,i}))
    .sort((a,b)=>{
      const ay = a.c.year===null||a.c.year===undefined ? Infinity : a.c.year;
      const by = b.c.year===null||b.c.year===undefined ? Infinity : b.c.year;
      if(ay!==by) return asc ? ay-by : by-ay;
      return a.c.order - b.c.order; // 同年は登録順で安定ソート
    })
    .map(x=>x.c);
}
function shuffle(arr){
  const a = [...arr];
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function buildMap(card, revealed, onReveal, subject){
  const container = document.createElement("div");
  let regions, correctId;
  if(subject==="japanese_history"){
    regions = JAPAN_REGIONS;
    correctId = card.whereRegion;
    const label = document.createElement("div");
    label.className="era-label";
    label.textContent="日本地図(簡易ブロック版)";
    container.appendChild(label);
  }else{
    const era = eraForYear(card.year);
    regions = WORLD_REGIONS_BY_ERA[era.id];
    correctId = card.whereRegion;
    const label = document.createElement("div");
    label.className="era-label";
    label.textContent=`世界地図・${era.label}(簡易ブロック版)`;
    container.appendChild(label);
  }

  const svgNS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(svgNS,"svg");
  svg.setAttribute("viewBox","0 0 400 260");
  svg.setAttribute("class","map");

  regions.forEach(r=>{
    const rect = document.createElementNS(svgNS,"rect");
    rect.setAttribute("x",r.x); rect.setAttribute("y",r.y);
    rect.setAttribute("width",r.w); rect.setAttribute("height",r.h);
    rect.setAttribute("class","region"+((revealed && r.id===correctId)?" correct":""));
    rect.onclick = ()=>{ if(!revealed) onReveal(); };
    svg.appendChild(rect);

    const text = document.createElementNS(svgNS,"text");
    text.setAttribute("x", r.x + r.w/2);
    text.setAttribute("y", r.y + r.h/2);
    text.setAttribute("text-anchor","middle");
    text.setAttribute("class","region-label");
    text.textContent = r.name;
    svg.appendChild(text);
  });

  container.appendChild(svg);

  if(!revealed){
    const helper = document.createElement("div");
    helper.className="hint";
    helper.style.marginTop="6px";
    helper.textContent="地図をタップすると「どこで」が表示されます。";
    container.appendChild(helper);
  }else{
    const helper = document.createElement("div");
    helper.className="hint";
    helper.style.marginTop="6px";
    helper.textContent = correctId ? "赤く塗られた地域が該当エリアです。" : "この問題には地図判定用の地域が設定されていません。";
    container.appendChild(helper);
  }
  return container;
}

/* ---------- 表作成画面 ---------- */
function renderTable(main){
  const folder = folders.find(f=>f.id===route.params.folderId);
  if(!folder){ navigate("home"); return; }
  const folderCards = cards.filter(c=>c.folderId===folder.id);

  if(!uiState.tableOrder) uiState.tableOrder = "asc";
  if(!uiState.tableVisible) uiState.tableVisible = new Set(ELEMENTS); // デフォルト全表示

  const controls = document.createElement("div");
  controls.style.marginBottom="16px";

  const orderRow = document.createElement("div");
  orderRow.className="radio-group";
  orderRow.style.marginBottom="12px";
  [["asc","年号昇順"],["desc","年号降順"]].forEach(([key,label])=>{
    const chip = document.createElement("div");
    chip.className="radio-chip"+(uiState.tableOrder===key?" selected":"");
    chip.textContent=label;
    chip.onclick=()=>{ uiState.tableOrder=key; render(); };
    orderRow.appendChild(chip);
  });
  controls.appendChild(orderRow);

  const toggles = document.createElement("div");
  toggles.className="table-toggles";
  ELEMENTS.forEach(key=>{
    const chip = document.createElement("div");
    const on = uiState.tableVisible.has(key);
    chip.className="toggle-chip"+(on?" on":"");
    chip.textContent=(on?"表示中: ":"非表示: ")+ELEMENT_LABEL[key];
    chip.onclick = ()=>{
      if(on) uiState.tableVisible.delete(key); else uiState.tableVisible.add(key);
      render();
    };
    toggles.appendChild(chip);
  });
  controls.appendChild(toggles);
  main.appendChild(controls);

  const sorted = stableSortByYear(folderCards, uiState.tableOrder==="asc");

  const table = document.createElement("table");
  table.className="timeline";
  const thead = document.createElement("thead");
  const headRow = document.createElement("tr");
  ELEMENTS.forEach(key=>{
    const th = document.createElement("th");
    th.textContent = ELEMENT_LABEL[key];
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement("tbody");
  sorted.forEach(c=>{
    const tr = document.createElement("tr");
    ELEMENTS.forEach(key=>{
      const td = document.createElement("td");
      const visible = uiState.tableVisible.has(key);
      if(!visible){
        td.className="masked";
        td.textContent="非表示";
      }else{
        td.textContent = formatFieldValue(key, c);
      }
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  main.appendChild(table);
}

function escapeHtml(str){
  return String(str||"").replace(/[&<>"']/g, m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
}

/* ===================== 起動 ===================== */
(async function init(){
  await loadData();
  render();
})();