const crypto = require("crypto")
require("dotenv").config()

const algorithm = "aes-256-ctr"

const secretKey = crypto
  .createHash("sha256")
  .update(process.env.API_ENCRYPTION_KEY)
  .digest()

function encrypt(text) {
  const iv = crypto.randomBytes(16)

  const cipher = crypto.createCipheriv(
    algorithm,
    secretKey,
    iv
  )

  const encrypted = Buffer.concat([
    cipher.update(text),
    cipher.final()
  ])

  return iv.toString("hex") + ":" + encrypted.toString("hex")
}

function decrypt(hash) {
  const [iv, content] = hash.split(":")

  const decipher = crypto.createDecipheriv(
    algorithm,
    secretKey,
    Buffer.from(iv, "hex")
  )

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(content, "hex")),
    decipher.final()
  ])

  return decrypted.toString()
}

module.exports = { encrypt, decrypt }