const nodemailer = require('nodemailer')

const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
})

exports.sendEmail = async (reciepients, subject, message) => {
    return await transport.sendMail({
        from: 'no-reply@example.com',
        to: reciepients,
        subject,
        text: message,
        html: message 
    })
}

