import 'dotenv/config'

export async function sendTelegramMessage(text: string) {
	const token = process.env.BOT_TOKEN
	const chatId = process.env.SELLER_CHAT_ID

	try {
		const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
			},
			body: JSON.stringify({
				chat_id: chatId,
				text,
			}),
		})

		const data = await res.json()
		console.log('TELEGRAM RESPONSE:', data)
	} catch (err) {
		console.error('TELEGRAM ERROR:', err)
	}
}
