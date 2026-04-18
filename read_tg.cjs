const fs = require('fs');
const path = "C:\\Users\\JSH\\Downloads\\Telegram Desktop\\ChatExport_2026-04-16\\messages.html";

try {
  const stats = fs.statSync(path);
  console.log('Size:', stats.size);
  const content = fs.readFileSync(path, 'utf8');
  // Simple regex to extract div class="text" contents which usually holds message text in TG export
  const matches = content.match(/<div class="text"[^>]*>([\s\S]*?)<\/div>/g) || [];
  
  const texts = matches.map(m => m.replace(/<[^>]+>/g, '').trim()).filter(t => t.length > 0);
  console.log(`Found ${texts.length} messages.`);
  
  // Dump a sample of the texts (first 50, unique patterns)
  const samples = Array.from(new Set(texts)).slice(0, 50);
  console.log("=== SAMPLES ===");
  samples.forEach(s => console.log(s.replace(/\n/g, '\\n')));
  
  fs.writeFileSync('tg_samples.txt', samples.join('\n\n--- \n\n'));
} catch (e) {
  console.error("Error reading file:", e.message);
}
