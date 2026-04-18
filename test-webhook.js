const text = "노승태/부산/회복\n수임료 660\n착수금 100";
const payload = {
  update_id: 1234,
  message: {
    message_id: 1111,
    from: { first_name: '테스트', last_name: '유저' },
    date: Math.floor(Date.now() / 1000),
    text: text
  }
};
fetch('https://cenksfblktflfurxjmtv.supabase.co/functions/v1/telegram-webhook', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
.then(res => res.json())
.then(data => console.log(data))
.catch(err => console.error(err));
