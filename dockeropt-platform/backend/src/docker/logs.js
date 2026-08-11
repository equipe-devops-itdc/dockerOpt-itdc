// ============================================================
// docker/logs.js — démultiplexage des logs Docker
// ------------------------------------------------------------
// Docker multiplexe stdout/stderr avec un en-tête de 8 octets par
// trame (1 octet type de flux, 3 octets de bourrage, 4 octets =
// longueur) quand le conteneur n'a PAS de TTY. Avec TTY, le flux
// est déjà du texte brut.
// ============================================================

function demuxDockerLogBuffer(buffer) {
  let out = '';
  let offset = 0;
  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset + 4);
    const start = offset + 8;
    const end = start + length;
    if (length < 0 || end > buffer.length) return null; // ne ressemble pas au format multiplexé
    out += buffer.slice(start, end).toString('utf-8');
    offset = end;
  }
  return offset === buffer.length ? out : null;
}

module.exports = { demuxDockerLogBuffer };