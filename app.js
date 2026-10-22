const $ = id => document.getElementById(id);
const HISTORY_KEY = "little-house-history-v1";
const MODEL_KEY = "little-house-model-v1";
let history = loadHistory();
let model = localStorage.getItem(MODEL_KEY) || "";
let busy = false;
const systemDefault = "You are Little House, a helpful, honest assistant. Be clear, practical, and use Markdown when useful.";
function loadHistory(){ try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function saveHistory(){ localStorage.setItem(HISTORY_KEY, JSON.stringify(history)); }
function escapeHTML(s){ return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function basicMarkdown(s){
  let out=escapeHTML(s);
  out=out.replace(/```([\\w+-]*)\\n?([\\s\\S]*?)```/g,(_,lang,code)=>'<pre><code>'+code+'</code></pre>');
  out=out.replace(/`([^`]+)`/g,'<code>$1</code>');
  out=out.replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');
  out=out.split(/\n{2,}/).map(p=>'<p>'+p.replace(/\n/g,'<br>')+'</p>').join('');
  return out;
}
function addMessage(role, content, persist=true){
  const article=document.createElement("article");article.className="message "+role;
  const avatar=document.createElement("div");avatar.className="avatar";avatar.textContent=role==="user"?"Y":"lh";
  const bubble=document.createElement("div");bubble.className="bubble";
  bubble.innerHTML=role==="assistant"?basicMarkdown(content):escapeHTML(content).replace(/\n/g,"<br>");
  article.append(avatar,bubble);
  if(role==="assistant"&&persist){const tools=document.createElement("div");tools.className="message-tools";const copy=document.createElement("button");copy.textContent="Copy response";copy.onclick=()=>navigator.clipboard.writeText(content).then(()=>copy.textContent="Copied").catch(()=>{});tools.append(copy);bubble.append(tools);}
  $("messages").append(article);return article;
}
function showMessages(){ $("welcome").hidden=true; $("messages").classList.add("visible"); }
function scrollBottom(){ $("messages").scrollTop=$("messages").scrollHeight; }
function setBusy(value){busy=value;$("sendButton").disabled=value;$("sendButton").textContent=value?"…":"↑";}
async function sendMessage(text){
  if(busy||!text.trim())return;
  showMessages();history.push({role:"user",content:text});saveHistory();addMessage("user",text);scrollBottom();
  const wait=addMessage("assistant","Thinking…",false);setBusy(true);
  try{
    if(!model)throw new Error("No local model selected. Open Settings and refresh the model list.");
    const messages=[{role:"system",content:$("systemPrompt").value.trim()||systemDefault},...history];
    const response=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({model,messages})});
    const data=await response.json();if(!response.ok)throw new Error(data.error||"The model request failed.");
    const answer=data.message||"(The model returned an empty reply.)";history.push({role:"assistant",content:answer});saveHistory();
    wait.remove();addMessage("assistant",answer);$("connection").textContent="Local model: "+(data.model||model);$("connection").classList.add("online");
  }catch(error){
    wait.querySelector(".bubble").textContent=error.message+" You can configure the model in Settings.";
    const retry=document.createElement("button");retry.className="subtle";retry.textContent="Retry";retry.onclick=()=>{wait.remove();const last=history.pop();saveHistory();if(last?.role==="user")sendMessage(last.content);};wait.querySelector(".bubble").append(document.createElement("br"),retry);
    $("connection").textContent="Model not connected";$("connection").classList.remove("online");
  }finally{setBusy(false);scrollBottom();}
}
$("composer").addEventListener("submit",e=>{e.preventDefault();const prompt=$("prompt");const value=prompt.value.trim();if(!value||busy)return;prompt.value="";prompt.style.height="auto";sendMessage(value);});
$("prompt").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();$("composer").requestSubmit();}});
$("prompt").addEventListener("input",e=>{e.target.style.height="auto";e.target.style.height=Math.min(e.target.scrollHeight,180)+"px";});
$("clearButton").onclick=()=>{history=[];saveHistory();$("messages").replaceChildren();$("messages").classList.remove("visible");$("welcome").hidden=false;};
$("settingsButton").onclick=()=>$("settings").showModal();
$("refreshModels").onclick=loadModels;
$("saveSettings").onclick=()=>{model=$("modelSelect").value;localStorage.setItem(MODEL_KEY,model);$("settings").close();checkHealth();};
async function loadModels(){
  const select=$("modelSelect");select.replaceChildren(new Option("Loading models…",""));
  try{const r=await fetch("/api/health");const data=await r.json();select.replaceChildren();if(!data.models.length)select.add(new Option("No models found",""));data.models.forEach(name=>select.add(new Option(name,name)));if(data.models.includes(model))select.value=model;else if(!model&&data.models.length)select.value=model=data.models[0];}
  catch{select.replaceChildren(new Option("Ollama unavailable",""));}
}
async function checkHealth(){
  try{const r=await fetch("/api/health");const data=await r.json();$("connection").textContent=data.connected?(model||data.models[0]||"Ollama connected"):"Local model not connected";$("connection").classList.toggle("online",data.connected);}
  catch{$("connection").textContent="Local model not connected";}
}
$("searchButton").onclick=async()=>{
  const q=$("prompt").value.trim();if(!q){$("prompt").placeholder="Type a search query, then press Web search";$("prompt").focus();return;}
  $("prompt").value="";
  showMessages();const status=addMessage("assistant","Searching reference results…",false);
  try{const r=await fetch("/api/search?q="+encodeURIComponent(q));const data=await r.json();if(!r.ok)throw new Error(data.error||"Search failed.");
    status.querySelector(".bubble").innerHTML="<strong>Reference results</strong>"+data.results.map(item=>'<p><a target="_blank" rel="noopener noreferrer" href="'+escapeHTML(item.url)+'">'+escapeHTML(item.title)+'</a><br>'+escapeHTML(item.snippet)+'</p>').join("")+'<p><a target="_blank" rel="noopener noreferrer" href="'+escapeHTML(data.webUrl)+'">Open full web search ↗</a></p>';
  }catch(error){status.querySelector(".bubble").textContent=error.message+" ";const link=document.createElement("a");link.href="https://duckduckgo.com/?q="+encodeURIComponent(q);link.target="_blank";link.rel="noopener noreferrer";link.textContent="Open DuckDuckGo search";status.querySelector(".bubble").append(link);}
  scrollBottom();
};
loadModels();checkHealth();
