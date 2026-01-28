import{as as gt,a as pt,n as Tt,at as V,t as $,au as H,av as O,aw as S,ax as bt,ay as Nt,az as G,aA as z,f as P,aB as v,ak as Dt,p as Mt,ac as Lt}from"./index.Mfw4FXKn.js";function X(t,e,n){return gt(t,e*7,n)}function $t(t){return pt(t,Date.now())}function Pt(t,e,n){const[o,s]=Tt(n==null?void 0:n.in,t,e);return+V(o)==+V(s)}function xt(t,e){return $(t,e==null?void 0:e.in).getDay()}function Ft(t,e){return+$(t)<+$(e)}function Ht(t){return+$(t)<Date.now()}function yt(t,e){return Pt(pt(t,t),$t(t))}function Gt(t,e,n){let o=e-xt(t,n);return o<=0&&(o+=7),gt(t,o,n)}const Ut={lessThanXSeconds:{one:"1초 미만",other:"{{count}}초 미만"},xSeconds:{one:"1초",other:"{{count}}초"},halfAMinute:"30초",lessThanXMinutes:{one:"1분 미만",other:"{{count}}분 미만"},xMinutes:{one:"1분",other:"{{count}}분"},aboutXHours:{one:"약 1시간",other:"약 {{count}}시간"},xHours:{one:"1시간",other:"{{count}}시간"},xDays:{one:"1일",other:"{{count}}일"},aboutXWeeks:{one:"약 1주",other:"약 {{count}}주"},xWeeks:{one:"1주",other:"{{count}}주"},aboutXMonths:{one:"약 1개월",other:"약 {{count}}개월"},xMonths:{one:"1개월",other:"{{count}}개월"},aboutXYears:{one:"약 1년",other:"약 {{count}}년"},xYears:{one:"1년",other:"{{count}}년"},overXYears:{one:"1년 이상",other:"{{count}}년 이상"},almostXYears:{one:"거의 1년",other:"거의 {{count}}년"}},jt=(t,e,n)=>{let o;const s=Ut[t];return typeof s=="string"?o=s:e===1?o=s.one:o=s.other.replace("{{count}}",e.toString()),n!=null&&n.addSuffix?n.comparison&&n.comparison>0?o+" 후":o+" 전":o},kt={full:"y년 M월 d일 EEEE",long:"y년 M월 d일",medium:"y.MM.dd",short:"y.MM.dd"},Kt={full:"a H시 mm분 ss초 zzzz",long:"a H:mm:ss z",medium:"HH:mm:ss",short:"HH:mm"},Yt={full:"{{date}} {{time}}",long:"{{date}} {{time}}",medium:"{{date}} {{time}}",short:"{{date}} {{time}}"},Bt={date:H({formats:kt,defaultWidth:"full"}),time:H({formats:Kt,defaultWidth:"full"}),dateTime:H({formats:Yt,defaultWidth:"full"})},Wt={lastWeek:"'지난' eeee p",yesterday:"'어제' p",today:"'오늘' p",tomorrow:"'내일' p",nextWeek:"'다음' eeee p",other:"P"},qt=(t,e,n,o)=>Wt[t],Vt={narrow:["BC","AD"],abbreviated:["BC","AD"],wide:["기원전","서기"]},zt={narrow:["1","2","3","4"],abbreviated:["Q1","Q2","Q3","Q4"],wide:["1분기","2분기","3분기","4분기"]},Xt={narrow:["1","2","3","4","5","6","7","8","9","10","11","12"],abbreviated:["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"],wide:["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"]},Jt={narrow:["일","월","화","수","목","금","토"],short:["일","월","화","수","목","금","토"],abbreviated:["일","월","화","수","목","금","토"],wide:["일요일","월요일","화요일","수요일","목요일","금요일","토요일"]},Qt={narrow:{am:"오전",pm:"오후",midnight:"자정",noon:"정오",morning:"아침",afternoon:"오후",evening:"저녁",night:"밤"},abbreviated:{am:"오전",pm:"오후",midnight:"자정",noon:"정오",morning:"아침",afternoon:"오후",evening:"저녁",night:"밤"},wide:{am:"오전",pm:"오후",midnight:"자정",noon:"정오",morning:"아침",afternoon:"오후",evening:"저녁",night:"밤"}},Zt={narrow:{am:"오전",pm:"오후",midnight:"자정",noon:"정오",morning:"아침",afternoon:"오후",evening:"저녁",night:"밤"},abbreviated:{am:"오전",pm:"오후",midnight:"자정",noon:"정오",morning:"아침",afternoon:"오후",evening:"저녁",night:"밤"},wide:{am:"오전",pm:"오후",midnight:"자정",noon:"정오",morning:"아침",afternoon:"오후",evening:"저녁",night:"밤"}},te=(t,e)=>{const n=Number(t);switch(String(e==null?void 0:e.unit)){case"minute":case"second":return String(n);case"date":return n+"일";default:return n+"번째"}},ee={ordinalNumber:te,era:O({values:Vt,defaultWidth:"wide"}),quarter:O({values:zt,defaultWidth:"wide",argumentCallback:t=>t-1}),month:O({values:Xt,defaultWidth:"wide"}),day:O({values:Jt,defaultWidth:"wide"}),dayPeriod:O({values:Qt,defaultWidth:"wide",formattingValues:Zt,defaultFormattingWidth:"wide"})},ne=/^(\d+)(일|번째)?/i,oe=/\d+/i,se={narrow:/^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,abbreviated:/^(b\.?\s?c\.?|b\.?\s?c\.?\s?e\.?|a\.?\s?d\.?|c\.?\s?e\.?)/i,wide:/^(기원전|서기)/i},ie={any:[/^(bc|기원전)/i,/^(ad|서기)/i]},ae={narrow:/^[1234]/i,abbreviated:/^q[1234]/i,wide:/^[1234]사?분기/i},re={any:[/1/i,/2/i,/3/i,/4/i]},ce={narrow:/^(1[012]|[123456789])/,abbreviated:/^(1[012]|[123456789])월/i,wide:/^(1[012]|[123456789])월/i},le={any:[/^1월?$/,/^2/,/^3/,/^4/,/^5/,/^6/,/^7/,/^8/,/^9/,/^10/,/^11/,/^12/]},ue={narrow:/^[일월화수목금토]/,short:/^[일월화수목금토]/,abbreviated:/^[일월화수목금토]/,wide:/^[일월화수목금토]요일/},de={any:[/^일/,/^월/,/^화/,/^수/,/^목/,/^금/,/^토/]},fe={any:/^(am|pm|오전|오후|자정|정오|아침|저녁|밤)/i},he={any:{am:/^(am|오전)/i,pm:/^(pm|오후)/i,midnight:/^자정/i,noon:/^정오/i,morning:/^아침/i,afternoon:/^오후/i,evening:/^저녁/i,night:/^밤/i}},me={ordinalNumber:bt({matchPattern:ne,parsePattern:oe,valueCallback:t=>parseInt(t,10)}),era:S({matchPatterns:se,defaultMatchWidth:"wide",parsePatterns:ie,defaultParseWidth:"any"}),quarter:S({matchPatterns:ae,defaultMatchWidth:"wide",parsePatterns:re,defaultParseWidth:"any",valueCallback:t=>t+1}),month:S({matchPatterns:ce,defaultMatchWidth:"wide",parsePatterns:le,defaultParseWidth:"any"}),day:S({matchPatterns:ue,defaultMatchWidth:"wide",parsePatterns:de,defaultParseWidth:"any"}),dayPeriod:S({matchPatterns:fe,defaultMatchWidth:"any",parsePatterns:he,defaultParseWidth:"any"})},ge={code:"ko",formatDistance:jt,formatLong:Bt,formatRelative:qt,localize:ee,match:me,options:{weekStartsOn:0,firstWeekContainsDate:1}};var J;(function(t){t.STRING="string",t.NUMBER="number",t.INTEGER="integer",t.BOOLEAN="boolean",t.ARRAY="array",t.OBJECT="object"})(J||(J={}));/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */var Q;(function(t){t.LANGUAGE_UNSPECIFIED="language_unspecified",t.PYTHON="python"})(Q||(Q={}));var Z;(function(t){t.OUTCOME_UNSPECIFIED="outcome_unspecified",t.OUTCOME_OK="outcome_ok",t.OUTCOME_FAILED="outcome_failed",t.OUTCOME_DEADLINE_EXCEEDED="outcome_deadline_exceeded"})(Z||(Z={}));/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const tt=["user","model","function","system"];var et;(function(t){t.HARM_CATEGORY_UNSPECIFIED="HARM_CATEGORY_UNSPECIFIED",t.HARM_CATEGORY_HATE_SPEECH="HARM_CATEGORY_HATE_SPEECH",t.HARM_CATEGORY_SEXUALLY_EXPLICIT="HARM_CATEGORY_SEXUALLY_EXPLICIT",t.HARM_CATEGORY_HARASSMENT="HARM_CATEGORY_HARASSMENT",t.HARM_CATEGORY_DANGEROUS_CONTENT="HARM_CATEGORY_DANGEROUS_CONTENT",t.HARM_CATEGORY_CIVIC_INTEGRITY="HARM_CATEGORY_CIVIC_INTEGRITY"})(et||(et={}));var nt;(function(t){t.HARM_BLOCK_THRESHOLD_UNSPECIFIED="HARM_BLOCK_THRESHOLD_UNSPECIFIED",t.BLOCK_LOW_AND_ABOVE="BLOCK_LOW_AND_ABOVE",t.BLOCK_MEDIUM_AND_ABOVE="BLOCK_MEDIUM_AND_ABOVE",t.BLOCK_ONLY_HIGH="BLOCK_ONLY_HIGH",t.BLOCK_NONE="BLOCK_NONE"})(nt||(nt={}));var ot;(function(t){t.HARM_PROBABILITY_UNSPECIFIED="HARM_PROBABILITY_UNSPECIFIED",t.NEGLIGIBLE="NEGLIGIBLE",t.LOW="LOW",t.MEDIUM="MEDIUM",t.HIGH="HIGH"})(ot||(ot={}));var st;(function(t){t.BLOCKED_REASON_UNSPECIFIED="BLOCKED_REASON_UNSPECIFIED",t.SAFETY="SAFETY",t.OTHER="OTHER"})(st||(st={}));var T;(function(t){t.FINISH_REASON_UNSPECIFIED="FINISH_REASON_UNSPECIFIED",t.STOP="STOP",t.MAX_TOKENS="MAX_TOKENS",t.SAFETY="SAFETY",t.RECITATION="RECITATION",t.LANGUAGE="LANGUAGE",t.BLOCKLIST="BLOCKLIST",t.PROHIBITED_CONTENT="PROHIBITED_CONTENT",t.SPII="SPII",t.MALFORMED_FUNCTION_CALL="MALFORMED_FUNCTION_CALL",t.OTHER="OTHER"})(T||(T={}));var it;(function(t){t.TASK_TYPE_UNSPECIFIED="TASK_TYPE_UNSPECIFIED",t.RETRIEVAL_QUERY="RETRIEVAL_QUERY",t.RETRIEVAL_DOCUMENT="RETRIEVAL_DOCUMENT",t.SEMANTIC_SIMILARITY="SEMANTIC_SIMILARITY",t.CLASSIFICATION="CLASSIFICATION",t.CLUSTERING="CLUSTERING"})(it||(it={}));var at;(function(t){t.MODE_UNSPECIFIED="MODE_UNSPECIFIED",t.AUTO="AUTO",t.ANY="ANY",t.NONE="NONE"})(at||(at={}));var rt;(function(t){t.MODE_UNSPECIFIED="MODE_UNSPECIFIED",t.MODE_DYNAMIC="MODE_DYNAMIC"})(rt||(rt={}));/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class y extends Error{constructor(e){super(`[GoogleGenerativeAI Error]: ${e}`)}}class I extends y{constructor(e,n){super(e),this.response=n}}class Et extends y{constructor(e,n,o,s){super(e),this.status=n,this.statusText=o,this.errorDetails=s}}class _ extends y{}class Ct extends y{}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const pe="https://generativelanguage.googleapis.com",ye="v1beta",Ee="0.24.1",Ce="genai-js";var A;(function(t){t.GENERATE_CONTENT="generateContent",t.STREAM_GENERATE_CONTENT="streamGenerateContent",t.COUNT_TOKENS="countTokens",t.EMBED_CONTENT="embedContent",t.BATCH_EMBED_CONTENTS="batchEmbedContents"})(A||(A={}));class _e{constructor(e,n,o,s,i){this.model=e,this.task=n,this.apiKey=o,this.stream=s,this.requestOptions=i}toString(){var e,n;const o=((e=this.requestOptions)===null||e===void 0?void 0:e.apiVersion)||ye;let i=`${((n=this.requestOptions)===null||n===void 0?void 0:n.baseUrl)||pe}/${o}/${this.model}:${this.task}`;return this.stream&&(i+="?alt=sse"),i}}function ve(t){const e=[];return t!=null&&t.apiClient&&e.push(t.apiClient),e.push(`${Ce}/${Ee}`),e.join(" ")}async function Ae(t){var e;const n=new Headers;n.append("Content-Type","application/json"),n.append("x-goog-api-client",ve(t.requestOptions)),n.append("x-goog-api-key",t.apiKey);let o=(e=t.requestOptions)===null||e===void 0?void 0:e.customHeaders;if(o){if(!(o instanceof Headers))try{o=new Headers(o)}catch(s){throw new _(`unable to convert customHeaders value ${JSON.stringify(o)} to Headers: ${s.message}`)}for(const[s,i]of o.entries()){if(s==="x-goog-api-key")throw new _(`Cannot set reserved header name ${s}`);if(s==="x-goog-api-client")throw new _(`Header name ${s} can only be set using the apiClient field`);n.append(s,i)}}return n}async function we(t,e,n,o,s,i){const a=new _e(t,e,n,o,i);return{url:a.toString(),fetchOptions:Object.assign(Object.assign({},Se(i)),{method:"POST",headers:await Ae(a),body:s})}}async function D(t,e,n,o,s,i={},a=fetch){const{url:r,fetchOptions:c}=await we(t,e,n,o,s,i);return Ie(r,c,a)}async function Ie(t,e,n=fetch){let o;try{o=await n(t,e)}catch(s){Re(s,t)}return o.ok||await Oe(o,t),o}function Re(t,e){let n=t;throw n.name==="AbortError"?(n=new Ct(`Request aborted when fetching ${e.toString()}: ${t.message}`),n.stack=t.stack):t instanceof Et||t instanceof _||(n=new y(`Error fetching from ${e.toString()}: ${t.message}`),n.stack=t.stack),n}async function Oe(t,e){let n="",o;try{const s=await t.json();n=s.error.message,s.error.details&&(n+=` ${JSON.stringify(s.error.details)}`,o=s.error.details)}catch{}throw new Et(`Error fetching from ${e.toString()}: [${t.status} ${t.statusText}] ${n}`,t.status,t.statusText,o)}function Se(t){const e={};if((t==null?void 0:t.signal)!==void 0||(t==null?void 0:t.timeout)>=0){const n=new AbortController;(t==null?void 0:t.timeout)>=0&&setTimeout(()=>n.abort(),t.timeout),t!=null&&t.signal&&t.signal.addEventListener("abort",()=>{n.abort()}),e.signal=n.signal}return e}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function k(t){return t.text=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning text from the first candidate only. Access response.candidates directly to use the other candidates.`),L(t.candidates[0]))throw new I(`${C(t)}`,t);return Te(t)}else if(t.promptFeedback)throw new I(`Text not available. ${C(t)}`,t);return""},t.functionCall=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`),L(t.candidates[0]))throw new I(`${C(t)}`,t);return console.warn("response.functionCall() is deprecated. Use response.functionCalls() instead."),ct(t)[0]}else if(t.promptFeedback)throw new I(`Function call not available. ${C(t)}`,t)},t.functionCalls=()=>{if(t.candidates&&t.candidates.length>0){if(t.candidates.length>1&&console.warn(`This response had ${t.candidates.length} candidates. Returning function calls from the first candidate only. Access response.candidates directly to use the other candidates.`),L(t.candidates[0]))throw new I(`${C(t)}`,t);return ct(t)}else if(t.promptFeedback)throw new I(`Function call not available. ${C(t)}`,t)},t}function Te(t){var e,n,o,s;const i=[];if(!((n=(e=t.candidates)===null||e===void 0?void 0:e[0].content)===null||n===void 0)&&n.parts)for(const a of(s=(o=t.candidates)===null||o===void 0?void 0:o[0].content)===null||s===void 0?void 0:s.parts)a.text&&i.push(a.text),a.executableCode&&i.push("\n```"+a.executableCode.language+`
`+a.executableCode.code+"\n```\n"),a.codeExecutionResult&&i.push("\n```\n"+a.codeExecutionResult.output+"\n```\n");return i.length>0?i.join(""):""}function ct(t){var e,n,o,s;const i=[];if(!((n=(e=t.candidates)===null||e===void 0?void 0:e[0].content)===null||n===void 0)&&n.parts)for(const a of(s=(o=t.candidates)===null||o===void 0?void 0:o[0].content)===null||s===void 0?void 0:s.parts)a.functionCall&&i.push(a.functionCall);if(i.length>0)return i}const be=[T.RECITATION,T.SAFETY,T.LANGUAGE];function L(t){return!!t.finishReason&&be.includes(t.finishReason)}function C(t){var e,n,o;let s="";if((!t.candidates||t.candidates.length===0)&&t.promptFeedback)s+="Response was blocked",!((e=t.promptFeedback)===null||e===void 0)&&e.blockReason&&(s+=` due to ${t.promptFeedback.blockReason}`),!((n=t.promptFeedback)===null||n===void 0)&&n.blockReasonMessage&&(s+=`: ${t.promptFeedback.blockReasonMessage}`);else if(!((o=t.candidates)===null||o===void 0)&&o[0]){const i=t.candidates[0];L(i)&&(s+=`Candidate was blocked due to ${i.finishReason}`,i.finishMessage&&(s+=`: ${i.finishMessage}`))}return s}function b(t){return this instanceof b?(this.v=t,this):new b(t)}function Ne(t,e,n){if(!Symbol.asyncIterator)throw new TypeError("Symbol.asyncIterator is not defined.");var o=n.apply(t,e||[]),s,i=[];return s={},a("next"),a("throw"),a("return"),s[Symbol.asyncIterator]=function(){return this},s;function a(l){o[l]&&(s[l]=function(u){return new Promise(function(g,E){i.push([l,u,g,E])>1||r(l,u)})})}function r(l,u){try{c(o[l](u))}catch(g){p(i[0][3],g)}}function c(l){l.value instanceof b?Promise.resolve(l.value.v).then(h,m):p(i[0][2],l)}function h(l){r("next",l)}function m(l){r("throw",l)}function p(l,u){l(u),i.shift(),i.length&&r(i[0][0],i[0][1])}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const lt=/^data\: (.*)(?:\n\n|\r\r|\r\n\r\n)/;function De(t){const e=t.body.pipeThrough(new TextDecoderStream("utf8",{fatal:!0})),n=$e(e),[o,s]=n.tee();return{stream:Le(o),response:Me(s)}}async function Me(t){const e=[],n=t.getReader();for(;;){const{done:o,value:s}=await n.read();if(o)return k(Pe(e));e.push(s)}}function Le(t){return Ne(this,arguments,function*(){const n=t.getReader();for(;;){const{value:o,done:s}=yield b(n.read());if(s)break;yield yield b(k(o))}})}function $e(t){const e=t.getReader();return new ReadableStream({start(o){let s="";return i();function i(){return e.read().then(({value:a,done:r})=>{if(r){if(s.trim()){o.error(new y("Failed to parse stream"));return}o.close();return}s+=a;let c=s.match(lt),h;for(;c;){try{h=JSON.parse(c[1])}catch{o.error(new y(`Error parsing JSON response: "${c[1]}"`));return}o.enqueue(h),s=s.substring(c[0].length),c=s.match(lt)}return i()}).catch(a=>{let r=a;throw r.stack=a.stack,r.name==="AbortError"?r=new Ct("Request aborted when reading from the stream"):r=new y("Error reading from the stream"),r})}}})}function Pe(t){const e=t[t.length-1],n={promptFeedback:e==null?void 0:e.promptFeedback};for(const o of t){if(o.candidates){let s=0;for(const i of o.candidates)if(n.candidates||(n.candidates=[]),n.candidates[s]||(n.candidates[s]={index:s}),n.candidates[s].citationMetadata=i.citationMetadata,n.candidates[s].groundingMetadata=i.groundingMetadata,n.candidates[s].finishReason=i.finishReason,n.candidates[s].finishMessage=i.finishMessage,n.candidates[s].safetyRatings=i.safetyRatings,i.content&&i.content.parts){n.candidates[s].content||(n.candidates[s].content={role:i.content.role||"user",parts:[]});const a={};for(const r of i.content.parts)r.text&&(a.text=r.text),r.functionCall&&(a.functionCall=r.functionCall),r.executableCode&&(a.executableCode=r.executableCode),r.codeExecutionResult&&(a.codeExecutionResult=r.codeExecutionResult),Object.keys(a).length===0&&(a.text=""),n.candidates[s].content.parts.push(a)}s++}o.usageMetadata&&(n.usageMetadata=o.usageMetadata)}return n}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _t(t,e,n,o){const s=await D(e,A.STREAM_GENERATE_CONTENT,t,!0,JSON.stringify(n),o);return De(s)}async function vt(t,e,n,o){const i=await(await D(e,A.GENERATE_CONTENT,t,!1,JSON.stringify(n),o)).json();return{response:k(i)}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function At(t){if(t!=null){if(typeof t=="string")return{role:"system",parts:[{text:t}]};if(t.text)return{role:"system",parts:[t]};if(t.parts)return t.role?t:{role:"system",parts:t.parts}}}function N(t){let e=[];if(typeof t=="string")e=[{text:t}];else for(const n of t)typeof n=="string"?e.push({text:n}):e.push(n);return xe(e)}function xe(t){const e={role:"user",parts:[]},n={role:"function",parts:[]};let o=!1,s=!1;for(const i of t)"functionResponse"in i?(n.parts.push(i),s=!0):(e.parts.push(i),o=!0);if(o&&s)throw new y("Within a single message, FunctionResponse cannot be mixed with other type of part in the request for sending chat message.");if(!o&&!s)throw new y("No content is provided for sending chat message.");return o?e:n}function Fe(t,e){var n;let o={model:e==null?void 0:e.model,generationConfig:e==null?void 0:e.generationConfig,safetySettings:e==null?void 0:e.safetySettings,tools:e==null?void 0:e.tools,toolConfig:e==null?void 0:e.toolConfig,systemInstruction:e==null?void 0:e.systemInstruction,cachedContent:(n=e==null?void 0:e.cachedContent)===null||n===void 0?void 0:n.name,contents:[]};const s=t.generateContentRequest!=null;if(t.contents){if(s)throw new _("CountTokensRequest must have one of contents or generateContentRequest, not both.");o.contents=t.contents}else if(s)o=Object.assign(Object.assign({},o),t.generateContentRequest);else{const i=N(t);o.contents=[i]}return{generateContentRequest:o}}function ut(t){let e;return t.contents?e=t:e={contents:[N(t)]},t.systemInstruction&&(e.systemInstruction=At(t.systemInstruction)),e}function He(t){return typeof t=="string"||Array.isArray(t)?{content:N(t)}:t}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const dt=["text","inlineData","functionCall","functionResponse","executableCode","codeExecutionResult"],Ge={user:["text","inlineData"],function:["functionResponse"],model:["text","functionCall","executableCode","codeExecutionResult"],system:["text"]};function Ue(t){let e=!1;for(const n of t){const{role:o,parts:s}=n;if(!e&&o!=="user")throw new y(`First content should be with role 'user', got ${o}`);if(!tt.includes(o))throw new y(`Each item should include role field. Got ${o} but valid roles are: ${JSON.stringify(tt)}`);if(!Array.isArray(s))throw new y("Content should have 'parts' property with an array of Parts");if(s.length===0)throw new y("Each Content should have at least one part");const i={text:0,inlineData:0,functionCall:0,functionResponse:0,fileData:0,executableCode:0,codeExecutionResult:0};for(const r of s)for(const c of dt)c in r&&(i[c]+=1);const a=Ge[o];for(const r of dt)if(!a.includes(r)&&i[r]>0)throw new y(`Content with role '${o}' can't contain '${r}' part`);e=!0}}function ft(t){var e;if(t.candidates===void 0||t.candidates.length===0)return!1;const n=(e=t.candidates[0])===null||e===void 0?void 0:e.content;if(n===void 0||n.parts===void 0||n.parts.length===0)return!1;for(const o of n.parts)if(o===void 0||Object.keys(o).length===0||o.text!==void 0&&o.text==="")return!1;return!0}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ht="SILENT_ERROR";class je{constructor(e,n,o,s={}){this.model=n,this.params=o,this._requestOptions=s,this._history=[],this._sendPromise=Promise.resolve(),this._apiKey=e,o!=null&&o.history&&(Ue(o.history),this._history=o.history)}async getHistory(){return await this._sendPromise,this._history}async sendMessage(e,n={}){var o,s,i,a,r,c;await this._sendPromise;const h=N(e),m={safetySettings:(o=this.params)===null||o===void 0?void 0:o.safetySettings,generationConfig:(s=this.params)===null||s===void 0?void 0:s.generationConfig,tools:(i=this.params)===null||i===void 0?void 0:i.tools,toolConfig:(a=this.params)===null||a===void 0?void 0:a.toolConfig,systemInstruction:(r=this.params)===null||r===void 0?void 0:r.systemInstruction,cachedContent:(c=this.params)===null||c===void 0?void 0:c.cachedContent,contents:[...this._history,h]},p=Object.assign(Object.assign({},this._requestOptions),n);let l;return this._sendPromise=this._sendPromise.then(()=>vt(this._apiKey,this.model,m,p)).then(u=>{var g;if(ft(u.response)){this._history.push(h);const E=Object.assign({parts:[],role:"model"},(g=u.response.candidates)===null||g===void 0?void 0:g[0].content);this._history.push(E)}else{const E=C(u.response);E&&console.warn(`sendMessage() was unsuccessful. ${E}. Inspect response object for details.`)}l=u}).catch(u=>{throw this._sendPromise=Promise.resolve(),u}),await this._sendPromise,l}async sendMessageStream(e,n={}){var o,s,i,a,r,c;await this._sendPromise;const h=N(e),m={safetySettings:(o=this.params)===null||o===void 0?void 0:o.safetySettings,generationConfig:(s=this.params)===null||s===void 0?void 0:s.generationConfig,tools:(i=this.params)===null||i===void 0?void 0:i.tools,toolConfig:(a=this.params)===null||a===void 0?void 0:a.toolConfig,systemInstruction:(r=this.params)===null||r===void 0?void 0:r.systemInstruction,cachedContent:(c=this.params)===null||c===void 0?void 0:c.cachedContent,contents:[...this._history,h]},p=Object.assign(Object.assign({},this._requestOptions),n),l=_t(this._apiKey,this.model,m,p);return this._sendPromise=this._sendPromise.then(()=>l).catch(u=>{throw new Error(ht)}).then(u=>u.response).then(u=>{if(ft(u)){this._history.push(h);const g=Object.assign({},u.candidates[0].content);g.role||(g.role="model"),this._history.push(g)}else{const g=C(u);g&&console.warn(`sendMessageStream() was unsuccessful. ${g}. Inspect response object for details.`)}}).catch(u=>{u.message!==ht&&console.error(u)}),l}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function ke(t,e,n,o){return(await D(e,A.COUNT_TOKENS,t,!1,JSON.stringify(n),o)).json()}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Ke(t,e,n,o){return(await D(e,A.EMBED_CONTENT,t,!1,JSON.stringify(n),o)).json()}async function Ye(t,e,n,o){const s=n.requests.map(a=>Object.assign(Object.assign({},a),{model:e}));return(await D(e,A.BATCH_EMBED_CONTENTS,t,!1,JSON.stringify({requests:s}),o)).json()}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class mt{constructor(e,n,o={}){this.apiKey=e,this._requestOptions=o,n.model.includes("/")?this.model=n.model:this.model=`models/${n.model}`,this.generationConfig=n.generationConfig||{},this.safetySettings=n.safetySettings||[],this.tools=n.tools,this.toolConfig=n.toolConfig,this.systemInstruction=At(n.systemInstruction),this.cachedContent=n.cachedContent}async generateContent(e,n={}){var o;const s=ut(e),i=Object.assign(Object.assign({},this._requestOptions),n);return vt(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(o=this.cachedContent)===null||o===void 0?void 0:o.name},s),i)}async generateContentStream(e,n={}){var o;const s=ut(e),i=Object.assign(Object.assign({},this._requestOptions),n);return _t(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(o=this.cachedContent)===null||o===void 0?void 0:o.name},s),i)}startChat(e){var n;return new je(this.apiKey,this.model,Object.assign({generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:(n=this.cachedContent)===null||n===void 0?void 0:n.name},e),this._requestOptions)}async countTokens(e,n={}){const o=Fe(e,{model:this.model,generationConfig:this.generationConfig,safetySettings:this.safetySettings,tools:this.tools,toolConfig:this.toolConfig,systemInstruction:this.systemInstruction,cachedContent:this.cachedContent}),s=Object.assign(Object.assign({},this._requestOptions),n);return ke(this.apiKey,this.model,o,s)}async embedContent(e,n={}){const o=He(e),s=Object.assign(Object.assign({},this._requestOptions),n);return Ke(this.apiKey,this.model,o,s)}async batchEmbedContents(e,n={}){const o=Object.assign(Object.assign({},this._requestOptions),n);return Ye(this.apiKey,this.model,e,o)}}/**
 * @license
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class Be{constructor(e){this.apiKey=e}getGenerativeModel(e,n){if(!e.model)throw new y("Must provide a model name. Example: genai.getGenerativeModel({ model: 'my-model-name' })");return new mt(this.apiKey,e,n)}getGenerativeModelFromCachedContent(e,n,o){if(!e.name)throw new _("Cached content must contain a `name` field.");if(!e.model)throw new _("Cached content must contain a `model` field.");const s=["model","systemInstruction"];for(const a of s)if(n!=null&&n[a]&&e[a]&&(n==null?void 0:n[a])!==e[a]){if(a==="model"){const r=n.model.startsWith("models/")?n.model.replace("models/",""):n.model,c=e.model.startsWith("models/")?e.model.replace("models/",""):e.model;if(r===c)continue}throw new _(`Different value for "${a}" specified in modelParams (${n[a]}) and cachedContent (${e[a]})`)}const i=Object.assign(Object.assign({},n),{model:e.model,tools:e.tools,toolConfig:e.toolConfig,systemInstruction:e.systemInstruction,cachedContent:e});return new mt(this.apiKey,i,o)}}const K=(t,e)=>{const o=e.filter(s=>s.active).filter(s=>{const i=t>=s.minFee,a=!s.maxFee||t<=s.maxFee;return i&&a});if(o.length!==0)return o.sort((s,i)=>i.minFee!==s.minFee?i.minFee-s.minFee:i.priority!==s.priority?i.priority-s.priority:i.updatedAt!==s.updatedAt?i.updatedAt.localeCompare(s.updatedAt):i.ruleId.localeCompare(s.ruleId)),o[0]},wt=(t,e)=>{if(!t)return 0;const n=K(t,e);return n?n.commission:0},It=(t,e,n)=>{if(!t.contractFee)return{payable:0,total:0,isPartial:!1};const o=K(t.contractFee,e);if(!o)return{payable:0,total:0,isPartial:!1};const s=(t.deposit1Amount||0)+(t.deposit2Amount||0),i=o.fullPayoutThreshold||0,a=n?n.downPaymentPercentage/100:.1,r=n?n.firstPayoutPercentage/100:.5;return i>0&&s>=i?{payable:o.commission,total:o.commission,isPartial:!1,rule:o}:s>=t.contractFee*a?{payable:o.commission*r,total:o.commission,isPartial:!0,rule:o}:{payable:0,total:o.commission,isPartial:!1,rule:o}},We=(t,e)=>{const n=[];return Nt.includes(t.status)&&(!t.reminders||t.reminders.length===0)&&n.push("리마인더 없음"),G.includes(t.status)&&!t.contractAt&&n.push("계약일 미입력"),G.includes(t.status)&&!t.contractFee&&n.push("수임료 미입력"),t.contractFee&&G.includes(t.status)&&e&&wt(t.contractFee,e.commissionRules)===0&&n.push("수당 룰 없음"),n},qe=t=>{const e=t.replace(/[^\d]/g,"");return e.length===2?parseInt(e,10)<=30?`20${e}`:`19${e}`:e},U=t=>t?String(t).replace(/[^0-9]/g,""):"",Ve=(t,e)=>{if(!t)return;const n=U(t);if(!(n.length<9))return e.find(o=>o.phone&&U(o.phone)===n)},f=t=>{if(t==null||isNaN(t))return"";if(t===0)return"0원";const e=Math.floor(t/1e4),n=t%1e4;return e>0&&n>0?`${e.toLocaleString()}억 ${n.toLocaleString()}만원`:e>0&&n===0?`${e.toLocaleString()}억원`:e===0&&n>0?`${n.toLocaleString()}만원`:"0원"},ze=(t,e=Dt)=>{var B,W,q;let n=e;t.maritalStatus==="미혼"&&(n=n.replace(/^\* 미성년 자녀 수 : .*\r?\n?/gm,"")),t.creditCardUse==="미사용"&&(n=n.replace(/^\* 신용카드 사용금액 : .*\r?\n?/gm,"")),t.jobTypes&&t.jobTypes.length===1&&t.jobTypes[0]==="무직"&&(n=n.replace(/^\* 4대보험 가입유무 : .*\r?\n?/gm,""));const o=[];t.housingType==="자가"?(t.ownHousePrice&&o.push(`집 시세 ${f(t.ownHousePrice)}`),t.ownHouseLoan&&o.push(`(집 담보대출 ${f(t.ownHouseLoan)})`),t.ownHouseOwner&&o.push(`[명의: ${t.ownHouseOwner}]`)):t.housingType==="무상거주"?(o.push("무상거주"),t.freeHousingOwner&&o.push(`[명의: ${t.freeHousingOwner}]`)):(t.deposit&&o.push(`보증금 ${f(t.deposit)}`),t.rent&&o.push(`월세 ${f(t.rent)}`),t.depositLoanAmount&&o.push(`(보증금 대출: ${f(t.depositLoanAmount)})`),t.rentContractor&&o.push(`[계약자: ${t.rentContractor}]`));const s=o.length>0?o.join(" "):"정보 없음",i=t.assets&&t.assets.length>0?t.assets.map(d=>{const R=d.desc?`(${d.desc})`:"",St=d.rentDeposit?`/전세${f(d.rentDeposit)}`:"";return`(${d.owner}/${d.type}${R} 시세 ${f(d.amount)}${d.loanAmount?`/담보${f(d.loanAmount)}`:""}${St})`}):[];let a=i.length>0?i.join(" "):"없음";const r=[];let c=0;t.housingType!=="자가"&&t.housingType!=="무상거주"&&t.depositLoanAmount&&(r.push(`보증금 대출(${f(t.depositLoanAmount)})`),c+=t.depositLoanAmount),t.housingType==="자가"&&t.ownHouseLoan&&(r.push(`집 담보 대출(${f(t.ownHouseLoan)})`),c+=t.ownHouseLoan),t.assets&&t.assets.filter(d=>d.loanAmount>0).forEach(d=>{r.push(`${d.type} 담보(${f(d.loanAmount)})`),c+=d.loanAmount}),t.collateralLoanMemo&&r.push(t.collateralLoanMemo);let h=r.length>0?r.join(", "):"없음";c>0&&(h+=` [총 합계: ${f(c)}]`);let m=0;const p=t.creditLoan&&t.creditLoan.length>0?t.creditLoan.map(d=>(m+=d.amount||0,`${d.desc} ${f(d.amount)}`)):[];t.creditCardUse==="사용"&&t.creditCardAmount&&(m+=t.creditCardAmount,p.push(`신용카드 ${f(t.creditCardAmount)}`));let l=p.length>0?p.join(", "):"없음";m>0&&(l+=` [총 합계: ${f(m)}]`);let u=t.historyType||"없음";t.historyType&&t.historyType!=="없음"&&t.historyMemo&&(u+=` (${t.historyMemo})`);const g=t.specialMemo?[...t.specialMemo].filter(d=>!d.content.startsWith("[상태변경]")).sort((d,R)=>R.createdAt.localeCompare(d.createdAt)):[],E=g.length>0?g.map(d=>`[${P(new Date(d.createdAt),"yyyy-MM-dd HH:mm",{locale:ge})}]
${d.content}`).join(`

`):"없음",M=t.jobTypes&&t.jobTypes.length>0?t.jobTypes.join(", "):"정보 없음",w=[];(B=t.incomeDetails)!=null&&B.salary&&w.push(`직장인 ${f(t.incomeDetails.salary)}`),(W=t.incomeDetails)!=null&&W.business&&w.push(`사업자 ${f(t.incomeDetails.business)}`),(q=t.incomeDetails)!=null&&q.freelance&&w.push(`프리랜서 ${f(t.incomeDetails.freelance)}`);let x=w.join(" + ");w.length>1?x+=` (총 ${f(t.incomeNet)})`:w.length===0&&(x=f(t.incomeNet));const Y={managerName:t.managerName,customerName:t.customerName,phone:t.phone,birth:t.birth?t.birth+"년생":"-",gender:t.gender,region:t.region,jobTypes:M,insurance4:t.insurance4,maritalStatus:t.maritalStatus,childrenCount:t.childrenCount!==void 0?t.childrenCount+"명":"-",incomeDetails:x,loanMonthlyPay:f(t.loanMonthlyPay),housingType:t.housingType,housingDetail:t.housingDetail,depositRentStr:s,assetsStr:a,creditLoanStr:l,collateralStr:h,creditCardUse:t.creditCardUse||"미사용",creditCardAmountStr:t.creditCardUse==="사용"&&t.creditCardAmount?f(t.creditCardAmount):"없음",historyStr:u,specialMemo:E};let F=n;for(const d in Y){const R=new RegExp(`{{${d}}}`,"g");F=F.replace(R,Y[d]||"")}return F.trim()},Rt=t=>{if(!t)return null;const e=Mt(t,"yyyy-MM-dd HH:mm",new Date);return v(e)?e:null},Xe=t=>{if(!t)return"none";const e=Rt(t);return e?yt(e)?"today":Ht(e)?"overdue":"future":"none"},Je=t=>{if(t==null)return null;if(t instanceof Date)return v(t)?t:null;const e=String(t);if(!e)return null;const n=new Date(e);if(v(n)&&e.includes("-")&&!isNaN(n.getTime()))return n;const o=e.trim(),s=/(\d{4})[\.\-]\s*(\d{1,2})[\.\-]\s*(\d{1,2})[\.]?\s*(오전|오후)?\s*(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/,i=o.match(s);if(i){const h=parseInt(i[1]),m=parseInt(i[2])-1,p=parseInt(i[3]),l=i[4];let u=parseInt(i[5]);const g=parseInt(i[6]),E=i[7]?parseInt(i[7]):0;l==="오후"&&u<12&&(u+=12),l==="오전"&&u===12&&(u=0);const M=new Date(h,m,p,u,g,E);if(v(M))return M}const a=/(\d{4})[\.\-]\s*(\d{1,2})[\.\-]\s*(\d{1,2})/,r=o.match(a);if(r){const h=parseInt(r[1]),m=parseInt(r[2])-1,p=parseInt(r[3]),l=new Date(h,m,p);if(v(l))return l}const c=new Date(e.replace(/\./g,"-"));return v(c)&&!isNaN(c.getTime())?c:null},j=t=>["일","월","화","수","목","금","토"][t]||"",Qe=(t,e)=>{const n=e.commissionRules,o=e.settlementConfig,s=t.filter(m=>m.partnerId===e.partnerId&&["1차 입금완료","2차 입금완료","계약 완료"].includes(m.status)&&m.contractFee);let i=0,a=0;s.forEach(m=>{const p=(m.deposit1Amount||0)+(m.deposit2Amount||0);i+=p;const{payable:l}=It(m,n,o);a+=l});const r=new Date;let c=z(r,o.cutoffDay,{weekStartsOn:0});Ft(c,r)&&!yt(c)&&(c=Gt(r,o.cutoffDay));let h=z(c,o.payoutDay,{weekStartsOn:0});return o.payoutDay<=o.cutoffDay&&(h=X(h,1)),o.payoutWeekDelay>0&&(h=X(h,o.payoutWeekDelay)),{cutoffDate:P(c,"yyyy-MM-dd"),payoutDate:P(h,"yyyy-MM-dd"),currentTotalDeposit:i,expectedCommission:a,threshold:0,isEligible:a>0,cutoffDayName:j(o.cutoffDay),payoutDayName:j(o.payoutDay)}},Ot=t=>new Promise((e,n)=>{const o=new FileReader;o.readAsDataURL(t),o.onload=()=>{if(typeof o.result=="string"){const s=o.result.split(",")[1];e(s)}},o.onerror=s=>n(s)}),Ze=t=>{if(!t)return"";if(!t.includes("drive.google.com"))return t;let e="";const n=t.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);if(n)e=n[1];else{const o=t.match(/[?&]id=([a-zA-Z0-9_-]+)/);o&&(e=o[1])}return e?`https://drive.google.com/uc?export=download&id=${e}`:t},tn=(t,e)=>{if(!t)return"";let n=t;const o=e.managerName||localStorage.getItem("managerName")||"담당자 미정",s=/^[*]?\s*담당자\s*:.*/m;return s.test(n)?n=n.replace(s,`* 담당자 : ${o}`):n=`* 담당자 : ${o}
`+n,n},en=(t,e,n="-")=>{if(!t)return n;try{const o=new Date(t);return v(o)?P(o,e):n}catch(o){return console.warn("Date formatting error:",o),n}},nn=t=>{const e=[];let n=0;return t.housingType!=="자가"&&t.housingType!=="무상거주"&&t.depositLoanAmount&&(e.push(`보증금 대출(${f(t.depositLoanAmount)})`),n+=t.depositLoanAmount),t.housingType==="자가"&&t.ownHouseLoan&&(e.push(`집 담보 대출(${f(t.ownHouseLoan)})`),n+=t.ownHouseLoan),t.assets&&t.assets.filter(o=>o.loanAmount>0).forEach(o=>{e.push(`${o.type} 담보(${f(o.loanAmount)})`),n+=o.loanAmount}),e.length===0?"없음":`${e.join(", ")} (총 ${f(n)})`},on=async(t,e)=>{const n=localStorage.getItem("lm_geminiApiKey"),o="AIzaSyAcY0S1fvge0FtV_GsmEo5u15vdsau4sBU",s=n||o;if(s.trim()===""){console.warn("Gemini API Key missing! Fallback to Mock.");const i=`오류 진단 정보:
- 저장된 키(User): ${n===null?"없음(Null)":n===""?"빈값":`있음(${n.length}자)`}
- 기본 키(Env): ${`있음(${o.length}자)`}`;return new Promise(a=>{setTimeout(()=>{a(`[데모 모드 v3] API 키가 확인되지 않습니다.

${i}

설정 페이지의 [AI 설정]에서 '등록된 키가 없습니다' 문구가 뜨는지 확인해주세요.
[자동 생성 예시] 내용 없음`)},1e3)})}try{const a=new Be(s).getGenerativeModel({model:"gemini-2.5-flash-lite"}),r=await Ot(t),c=e&&e.trim().length>0?e:Lt;return(await(await a.generateContent([c,{inlineData:{data:r,mimeType:t.type||"audio/mp3"}}])).response).text()}catch(i){console.error("Gemini AI Error:",i);let a=i instanceof Error?i.message:"알 수 없는 오류";if(a.includes("404")||a.includes("not found"))try{const c=await(await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${s}`)).json();if(c.models){const h=c.models.map(m=>m.name.replace("models/","")).join(", ");a+=`

[진단 - 사용 가능한 모델 목록]
${h}`}}catch(r){a+=`

[진단] 모델 목록 조회 실패 (CORS/Network): ${r}`}return`[오류 발생] AI 분석 중 문제가 발생했습니다.
사유: ${a}`}},an=Object.freeze(Object.defineProperty({__proto__:null,calculateCommission:wt,calculateNextSettlement:Qe,calculatePayableCommission:It,checkIsDuplicate:Ve,convertToPlayableUrl:Ze,fileToBase64:Ot,formatKoreanMoney:f,generateAiSummary:on,generateSummary:ze,getAutoCollateralString:nn,getCaseWarnings:We,getDayName:j,getMatchingRule:K,getReminderStatus:Xe,injectSummaryMetadata:tn,normalizeBirthYear:qe,normalizePhone:U,parseGenericDate:Je,parseReminder:Rt,safeFormat:en},Symbol.toStringTag,{value:"Module"}));export{Be as G,Pt as a,We as b,Qe as c,Ve as d,Je as e,Ot as f,Xe as g,Ze as h,yt as i,nn as j,ze as k,tn as l,wt as m,qe as n,on as o,Rt as p,j as q,en as s,an as u};
