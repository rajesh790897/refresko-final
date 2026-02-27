/**
 * Gravatar Utility Functions
 * Provides helper functions to generate Gravatar URLs and handle profile pictures
 */

/**
 * Simple MD5 hash implementation for email
 * Used to generate Gravatar URLs
 */
function md5(str) {
  const xl = []
  const mid = 7

  function md5cycle(x, k) {
    let a = x[0],
      b = x[1],
      c = x[2],
      d = x[3]

    a += (b & c) | (~b & d)
    a += k

    a = (a << mid) | (a >>> (32 - mid))
    a += b

    return a
  }

  function cmn(q, a, b, x, s, t) {
    a += q
    a += x
    a += t
    a = (a << s) | (a >>> (32 - s))
    a += b
    return a
  }

  function ff(a, b, c, d, x, s, t) {
    return cmn((b & c) | (~b & d), a, b, x, s, t)
  }

  function gg(a, b, c, d, x, s, t) {
    return cmn((b & d) | (c & ~d), a, b, x, s, t)
  }

  function hh(a, b, c, d, x, s, t) {
    return cmn(b ^ c ^ d, a, b, x, s, t)
  }

  function ii(a, b, c, d, x, s, t) {
    return cmn(c ^ (b | ~d), a, b, x, s, t)
  }

  function rh(a, b) {
    return ((a << 1) | (a >>> 31)) + ((b << 1) | (b >>> 31))
  }

  function rh2(a, b) {
    return (a >> 16) + (b >> 16) + ((a & 0xffff) + (b & 0xffff) >> 16) << 16
  }

  function safe_add(x, y) {
    const lsw = (x & 0xffff) + (y & 0xffff)
    const msw = (x >> 16) + (y >> 16) + (lsw >> 16)
    return (msw << 16) | (lsw & 0xffff)
  }

  function bit_rol(num, cnt) {
    return (num << cnt) | (num >>> (32 - cnt))
  }

  function md5cmn(q, a, b, x, s, t) {
    a = safe_add(a, q)
    a = safe_add(a, x)
    a = safe_add(a, t)
    a = bit_rol(a, s)
    a = safe_add(a, b)
    return a
  }

  function md5ff(a, b, c, d, x, s, t) {
    return md5cmn((b & c) | (~b & d), a, b, x, s, t)
  }

  function md5gg(a, b, c, d, x, s, t) {
    return md5cmn((b & d) | (c & ~d), a, b, x, s, t)
  }

  function md5hh(a, b, c, d, x, s, t) {
    return md5cmn(b ^ c ^ d, a, b, x, s, t)
  }

  function md5ii(a, b, c, d, x, s, t) {
    return md5cmn(c ^ (b | ~d), a, b, x, s, t)
  }

  // Convert string to array of little-endian words
  const x = []
  for (let i = 0; i < str.length; i++) {
    x[i >> 2] |= (str.charCodeAt(i) & 0xff) << ((i % 4) * 8)
  }
  x[str.length >> 2] |= 0x80 << (((str.length) % 4) * 8)
  x[((str.length + 8) >>> 6) * 16 + 14] = str.length * 8

  let a = 1732584193
  let b = -271733879
  let c = -1732584194
  let d = 271733878

  for (let i = 0; i < x.length; i += 16) {
    const olda = a
    const oldb = b
    const oldc = c
    const oldd = d

    a = md5ff(a, b, c, d, x[i], 7, -680876936)
    d = md5ff(d, a, b, c, x[i + 1], 12, -389564586)
    c = md5ff(c, d, a, b, x[i + 2], 17, 606105819)
    b = md5ff(b, c, d, a, x[i + 3], 22, -1044525550)
    a = md5ff(a, b, c, d, x[i + 4], 7, -176418792)
    d = md5ff(d, a, b, c, x[i + 5], 12, 1200080426)
    c = md5ff(c, d, a, b, x[i + 6], 17, -1473231341)
    b = md5ff(b, c, d, a, x[i + 7], 22, -45705983)
    a = md5ff(a, b, c, d, x[i + 8], 7, 1770035416)
    d = md5ff(d, a, b, c, x[i + 9], 12, -1958414417)
    c = md5ff(c, d, a, b, x[i + 10], 17, -42063)
    b = md5ff(b, c, d, a, x[i + 11], 22, -1990404162)
    a = md5ff(a, b, c, d, x[i + 12], 7, 1804603682)
    d = md5ff(d, a, b, c, x[i + 13], 12, -40341101)
    c = md5ff(c, d, a, b, x[i + 14], 17, -1502002290)
    b = md5ff(b, c, d, a, x[i + 15], 22, 1236535329)

    a = md5gg(a, b, c, d, x[i + 1], 5, -165796510)
    d = md5gg(d, a, b, c, x[i + 6], 9, -1069501632)
    c = md5gg(c, d, a, b, x[i + 11], 14, 643717713)
    b = md5gg(b, c, d, a, x[i + 0], 20, -373897302)
    a = md5gg(a, b, c, d, x[i + 5], 5, -701558691)
    d = md5gg(d, a, b, c, x[i + 10], 9, 38016083)
    c = md5gg(c, d, a, b, x[i + 15], 14, -660478335)
    b = md5gg(b, c, d, a, x[i + 4], 20, -405537848)
    a = md5gg(a, b, c, d, x[i + 9], 5, 568446438)
    d = md5gg(d, a, b, c, x[i + 14], 9, -1019803690)
    c = md5gg(c, d, a, b, x[i + 3], 14, -187363961)
    b = md5gg(b, c, d, a, x[i + 8], 20, 1163531501)
    a = md5gg(a, b, c, d, x[i + 13], 5, -1444681467)
    d = md5gg(d, a, b, c, x[i + 2], 9, -51403784)
    c = md5gg(c, d, a, b, x[i + 7], 14, 1735328661)
    b = md5gg(b, c, d, a, x[i + 12], 20, -1926607734)

    a = md5hh(a, b, c, d, x[i + 5], 4, -378558)
    d = md5hh(d, a, b, c, x[i + 8], 11, -2022574632)
    c = md5hh(c, d, a, b, x[i + 11], 16, 1839030562)
    b = md5hh(b, c, d, a, x[i + 14], 23, -35309556)
    a = md5hh(a, b, c, d, x[i + 1], 4, -1530992060)
    d = md5hh(d, a, b, c, x[i + 4], 11, 1272893353)
    c = md5hh(c, d, a, b, x[i + 7], 16, -155497632)
    b = md5hh(b, c, d, a, x[i + 10], 23, -1094730640)
    a = md5hh(a, b, c, d, x[i + 13], 4, 681279174)
    d = md5hh(d, a, b, c, x[i + 0], 11, -358537222)
    c = md5hh(c, d, a, b, x[i + 3], 16, -722521979)
    b = md5hh(b, c, d, a, x[i + 6], 23, 76029189)
    a = md5hh(a, b, c, d, x[i + 9], 4, -640364487)
    d = md5hh(d, a, b, c, x[i + 12], 11, -421815835)
    c = md5hh(c, d, a, b, x[i + 15], 16, 530742520)
    b = md5hh(b, c, d, a, x[i + 2], 23, -995338651)

    a = md5ii(a, b, c, d, x[i + 0], 6, -198630844)
    d = md5ii(d, a, b, c, x[i + 7], 10, 1126891415)
    c = md5ii(c, d, a, b, x[i + 14], 15, -1416354905)
    b = md5ii(b, c, d, a, x[i + 5], 21, -57434055)
    a = md5ii(a, b, c, d, x[i + 12], 6, 1700485571)
    d = md5ii(d, a, b, c, x[i + 3], 10, -1894986606)
    c = md5ii(c, d, a, b, x[i + 10], 15, -1051523)
    b = md5ii(b, c, d, a, x[i + 1], 21, -2054922799)
    a = md5ii(a, b, c, d, x[i + 8], 6, 1873313359)
    d = md5ii(d, a, b, c, x[i + 15], 10, -30611744)
    c = md5ii(c, d, a, b, x[i + 6], 15, -1560198380)
    b = md5ii(b, c, d, a, x[i + 13], 21, 1309151649)
    a = md5ii(a, b, c, d, x[i + 4], 6, -145523070)
    d = md5ii(d, a, b, c, x[i + 11], 10, -1120210379)
    c = md5ii(c, d, a, b, x[i + 2], 15, 718787259)
    b = md5ii(b, c, d, a, x[i + 9], 21, -343487606)

    a = safe_add(a, olda)
    b = safe_add(b, oldb)
    c = safe_add(c, oldc)
    d = safe_add(d, oldd)
  }

  return rh2(
    rh2(a, b),
    rh2(c, d)
  ).toString(16)
}

/**
 * Generate Gravatar URL from email address
 * @param {string} email - User email address
 * @param {number} size - Avatar size in pixels (default: 200)
 * @param {string} defaultImage - Default image type: 'identicon', 'monsterid', 'wavatar', 'retro', '404' (default: 'identicon')
 * @returns {string} Gravatar URL
 */
export function getGravatarUrl(email, size = 200, defaultImage = 'identicon') {
  if (!email || typeof email !== 'string') {
    return `https://www.gravatar.com/avatar/?s=${size}&d=${defaultImage}`
  }

  // Trim whitespace and convert to lowercase
  const cleanEmail = email.trim().toLowerCase()

  // Generate MD5 hash
  const emailHash = md5(cleanEmail)

  // Build URL with parameters
  const params = new URLSearchParams({
    s: size.toString(),
    d: defaultImage,
    r: 'pg' // Rating: parental guidance
  })

  return `https://www.gravatar.com/avatar/${emailHash}?${params.toString()}`
}

/**
 * Get initials from student name
 * @param {string} name - Full name
 * @returns {string} Initials (max 2 characters)
 */
export function getInitials(name) {
  if (!name || typeof name !== 'string') {
    return '?'
  }

  return name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0].toUpperCase())
    .join('')
}

/**
 * Get student avatar - Gravatar URL or initials as fallback
 * @param {string} email - Student email
 * @param {string} name - Student name for fallback initials
 * @param {number} size - Avatar size in pixels
 * @returns {object} Object with gravatar URL and initials fallback
 */
export function getStudentAvatar(email, name, size = 200) {
  return {
    gravatar: getGravatarUrl(email, size, 'identicon'),
    initials: getInitials(name),
    thumbnail: getGravatarUrl(email, size, 'identicon')
  }
}

export default {
  getGravatarUrl,
  getInitials,
  getStudentAvatar
}
