const crypto = require("crypto")

const algorithm = "aes-256-ctr"

const secretKey = crypto
  .createHash("sha256")
  .update("your-super-secret-key")
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

const encrypted = encrypt("hello world")
console.log("Encrypted:", encrypted)

const decrypted = decrypt(encrypted)
console.log("Decrypted:", decrypted)