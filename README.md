Daily DORK lotto app with telegram transaction monitoring, play on the dorkcoin blockchain.
 
https://dorkexplorer.com/ - explorer, 
https://coin.dorkcoingames.com/ - website,
https://dorkcoingames.com/ - dork arcade

How to deploy:
1. You need to install and run NODE.JS and install DORKCORE WALLET GUI QT version in Windows.
2. In DORKCORE WALLET you need to open : %APPDATA%\Dorkcoin\dorkcoin.conf and add these lines:
server=1
rpcport=22555
rpcuser=your_user
rpcpassword=Your_pass
4. In NODE.JS you need AXIOS, EXPRESS, CORS etc. installed, e.g. run npm install axios
5. Create a Telegram bot via @BotFather to get a bot token
6. Get your chat ID (you can message your bot and use https://api.telegram.org/bot<YOUR_BOT_TOKEN>/getUpdates) "chat": { "id": THIS_IS_IT, "first_name": "somename", "username": "someuser", "type": "private" }
7. replace TELEGRAM_CHAT_ID and TELEGRAM_BOT_TOKEN and paste your bot's token and chatID into the backend js file. Replace RPC_USER and RPC_PASS with your own into he backend js file. 
8. You can now run your backend script dorkwin_backend.js with NODE.JS - node dorkwin_backend.js
9. You need to open port 3000 (or 3001 if busy) so your Server is available outside
10. You can host the frontend index.html in any hosting. Change your API_URL to match your dorkcore server_ip:3000(3001)
   
How Frontend HTML Works:  
1. User enters their Dorkcoin address
2. Backend checks if they've played today
3. If not played → button becomes clickable
4. User clicks "OPEN CHEST"
5. Backend calculates random prize
6. Prize sent to user's address (if won)
7. Play recorded - user can't play again until tomorrow

DISCLAIMER: NO WARRANTY, USE AT YOUR OWN RISK! THIS IS MADE JUST FOR FUN AND TO LEARN AND I AM NOT RESPONSIBLE FOR ANY STOLEN FUNDS / FINANCIAL LOSS! IF YOU DEPLOY AND USE THESE SCRIPTS YOU SHOULD NEVER KEEP A LOT OF $DORK IN YOUR DORKCORE NODE RPC SERVER.

This project is open-source and contributions are welcome!

1.Fork this repository
2.Create a feature branch: git checkout -b feature/your-feature
3.Commit your changes: git commit -m 'Add some feature'
4.Push to the branch: git push origin feature/your-feature
5.Open a Pull Request

 
Licence: This project is open source
