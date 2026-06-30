Daily DORK lotto app, play on the dorkcoin blockchain.
 
https://dorkexplorer.com/ - explorer, 
https://coin.dorkcoingames.com/ - website,
https://dorkcoingames.com/ - dork arcade

How to install:
1. You need to run NODE.JS and DORKCORE WALLET GUI QT version in Windows.
2. In DORKCORE WALLET in Windows you need to open : %APPDATA%\Dorkcoin\dorkcoin.conf and add these lines:
server=1
rpcport=22555
rpcuser=your_user
rpcpassword=Your_pass
4. In NODE.JS you need AXIOS, EXPRESS, CORS etc. installed, e.g. run npm install axios
5. Create a Telegram bot via @BotFather to get a bot token
6. Get your chat ID (you can message your bot and use https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates) "chat": { "id": THIS_IS_IT, "first_name": "somename", "username": "someuser", "type": "private" }
7. paste your bot's token and chatID to the backend
8. You can then run your backend script dorkwin_backend.js with NODE.JS - node dorkwin_backend.js
9. You need to open port 3000 so your Server is available outside
10. You can host the frontend index.html in any hosting. Change your API_URL to match your dorkcore server_ip:3000
   
How Frontend HTML Works:  
1. User enters their Dorkcoin address
2. Backend checks if they've played today
3. If not played → button becomes clickable
4. User clicks "OPEN CHEST"
5. Backend calculates random prize
6. Prize sent to user's address (if won)
7. Play recorded - user can't play again until tomorrow
