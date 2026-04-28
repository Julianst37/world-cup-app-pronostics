/**
 * Form validators
 */

export const FIELD_MAX_LENGTHS = {
  displayName: 50,
  username: 20,
  email: 100,
  password: 64,
  tournamentName: 50,
  tournamentDescription: 250,
};

export function validateTournamentName(name) {
  if (!name || !name.trim()) return 'El nombre del torneo es requerido';
  if (name.trim().length < 3) return 'El nombre debe tener al menos 3 caracteres';
  if (name.trim().length > FIELD_MAX_LENGTHS.tournamentName) {
    return `El nombre no puede exceder ${FIELD_MAX_LENGTHS.tournamentName} caracteres`;
  }
  return null;
}

export function validateTournamentDescription(description) {
  if (!description) return null;
  if (description.trim().length > FIELD_MAX_LENGTHS.tournamentDescription) {
    return `La descripción no puede exceder ${FIELD_MAX_LENGTHS.tournamentDescription} caracteres`;
  }
  return null;
}

export function validateDisplayName(displayName) {
  if (!displayName || !displayName.trim()) return 'El nombre completo es requerido';
  if (displayName.trim().length > FIELD_MAX_LENGTHS.displayName) {
    return `El nombre completo no puede tener más de ${FIELD_MAX_LENGTHS.displayName} caracteres`;
  }
  if (!/^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]+$/.test(displayName.trim())) {
    return 'El nombre completo solo puede contener letras y espacios';
  }
  return null;
}

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'yopmail.com','yopmail.fr','cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx',
  'mega.zik.dj','speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf',
  'monmail.fr.nf','mailinator.com','mailinator.net','mailinator.org','trashmail.com',
  'trashmail.me','trashmail.net','trashmail.at','trashmail.io','trashmail.xyz',
  'guerrillamail.com','guerrillamail.net','guerrillamail.org','guerrillamail.biz',
  'guerrillamail.de','guerrillamail.info','guerrillamailblock.com','grr.la','guerrillamailblock.com',
  'spam4.me','sharklasers.com','guerrillamailblock.com','grr.la','guerrillamail.info',
  'tempmail.com','temp-mail.org','temp-mail.io','tempinbox.com','temporarymail.com',
  'throwam.com','throwam.net','dispostable.com','mailnull.com','spamgourmet.com',
  'spamgourmet.net','spamgourmet.org','spamherelots.com','spamhereplease.com',
  'maildrop.cc','mailnull.com','spambob.com','spamfree24.org','spamfree24.de',
  'spamfree24.eu','spamfree24.info','spamfree24.net','spamfree.eu',
  'fakeinbox.com','fakeinbox.net','fakemail.fr','fakemail.net',
  'discard.email','discardmail.com','discardmail.de','spamgrap.com',
  'mailexpire.com','spamgourmet.com','throwam.com','throwam.net',
  'getairmail.com','filzmail.com','owlpic.com','binkmail.com','bobmail.info',
  'chammy.info','devnullmail.com','letthemeatspam.com','mailandftp.com',
  'mailbidon.com','maileater.com','mailnew.com','mailsiphon.com','mailslapping.com',
  'mailzilla.org','mbx.cc','mega.zik.dj','meltmail.com','mierdamail.com',
  'mintemail.com','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
  'mt2009.com','mt2014.com','no-spam.ws','nobulk.com','noclickemail.com',
  'nogmailspam.info','nomail.pw','nomail.xl.cx','nomail2me.com','nomorespamemails.com',
  'nospam.ze.tc','nospamfor.us','nospammail.net','nospamthanks.info',
  'notmailinator.com','nowhere.org','nowmymail.com','nus.edu.sg',
  'objectmail.com','obobbo.com','oneoffmail.com','onewaymail.com',
  'pookmail.com','proxymail.eu','qq.com','rcpt.at','reallymymail.com',
  'rklips.com','rmqkr.net','royal.net','rtrtr.com',
  's0ny.net','safe-mail.net','safetymail.info','safetypost.de',
  'sandelf.de','saynotospams.com','selfdestructingmail.com',
  'sendspamhere.com','sharklasers.com','shieldedmail.com','shiftmail.com',
  'shitmail.me','shitware.nl','shortmail.net','sibmail.com',
  'skeefmail.com','slaskpost.se','slopsbox.com','smellfear.com',
  'snakemail.com','sneakemail.com','sneakmail.de','snkmail.com',
  'sofimail.com','sofort-mail.de','sogetthis.com','soodonims.com',
  'spam.la','spamavert.com','spamcon.org','spamcorptastic.com',
  'spamcowboy.com','spamcowboy.net','spamcowboy.org','spamday.com',
  'spameater.com','spameater.org','spamex.com','spamfree.eu',
  'spamgoes.in','spamgoes.in','spamhereplease.com','spamhole.com',
  'spamify.com','spaminator.de','spamkill.info','spaml.com',
  'spaml.de','spammotel.com','spamoff.de','spamslicer.com',
  'spamspot.com','spamstack.net','spamthis.co.uk','spamthisplease.com',
  'spamtrail.com','spamtroll.net','speed.1s.fr','supermailer.jp',
  'superrito.com','suremail.info','sweetxxx.de',
  'tafmail.com','tagyourself.com','tapchicuoihanoi.com',
  'techemail.com','telecomix.pl','tempalias.com','tempe-mail.com',
  'tempemail.biz','tempemail.co.za','tempemail.com','tempemail.net',
  'tempinbox.co.uk','tempinbox.com','tempmail.de','tempmail.eu',
  'tempmail.it','tempmail.net','tempmail.us','tempmail2.com',
  'tempomail.fr','temporaryemail.net','temporaryemail.us',
  'temporaryforwarding.com','temporaryinbox.com','throwam.com',
  'throwam.net','throwaway.email','throwawayemailaddress.com',
  'trash-amil.com','trash-mail.at','trash-mail.com','trash-mail.de',
  'trash-mail.io','trash-mail.net','trash2009.com','trash2010.com',
  'trash2011.com','trashemail.de','trashemails.de','trashimail.com',
  'trashmail.at','trashmail.com','trashmail.de','trashmail.io',
  'trashmail.me','trashmail.net','trashmail.org','trashmail.xyz',
  'trashmailer.com','trashspot.com','trbvm.com','trillianpro.com',
  'trnwatcher.com','trollproject.com','truestory.com','turual.com',
  'twinmail.de','tyldd.com','uggsrock.com',
  'umail.net','unids.com','uroid.com','used.hu',
  'veryrealemail.com','viditag.com','vipmail.name',
  'vpn.st','vsimcard.com','vubby.com',
  'wasteland.rfc822.org','webm4il.info','wegwerfadresse.de',
  'wegwerfemail.com','wegwerfemail.de','wegwerfmail.de',
  'wegwerfmail.net','wegwerfmail.org','wetrainbayarea.org',
  'whyspam.me','willhackforfood.biz','willselfdestruct.com',
  'wkrmt.com','wronghead.com','wuzupmail.net','www.e4ward.com',
  'www.gishpuppy.com','www.mailinator.com','wwwnew.eu',
  'x1post.com','xagloo.com','xemaps.com','xents.com',
  'xmaily.com','xoxy.net','xyzfree.net',
  'yapped.net','yeah.net','yogamaven.com','yopmail.com',
  'yopmail.fr','yopmail.pp.ua','you-spam.com','ypmail.webarnak.fr.eu.org',
  'yuurok.com','z1p.biz','za.com','zehnminuten.de',
  'zehnminuten.net','zehnminutenmail.de','zetmail.com',
  'zippiex.com','zippymail.info','zoaxe.com','zoemail.net',
  'zoemail.org','zomg.info',
]);

export function validateEmail(email) {
  if (!email) return 'El email es requerido';
  if (email.length > FIELD_MAX_LENGTHS.email) {
    return `El email no puede tener más de ${FIELD_MAX_LENGTHS.email} caracteres`;
  }
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!re.test(email)) return 'El email no es válido';
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain && DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return 'No se permiten correos temporales o desechables';
  }
  return null;
}

export function validatePassword(password) {
  if (!password) return 'La contraseña es requerida';
  if (password.length > FIELD_MAX_LENGTHS.password) {
    return `La contraseña no puede tener más de ${FIELD_MAX_LENGTHS.password} caracteres`;
  }
  if (password.length < 8) return 'La contraseña debe tener al menos 8 caracteres';
  if (!/[A-Z]/.test(password)) return 'La contraseña debe tener al menos una mayúscula';
  if (!/[0-9]/.test(password)) return 'La contraseña debe tener al menos un número';
  return null;
}

export function validateUsername(username) {
  if (!username) return 'El nombre de usuario es requerido';
  if (username.length < 3) return 'El nombre de usuario debe tener al menos 3 caracteres';
  if (username.length > 20) return 'El nombre de usuario no puede tener más de 20 caracteres';
  if (!/^[a-zA-Z0-9_]+$/.test(username)) {
    return 'El nombre de usuario solo puede contener letras, números y guiones bajos';
  }
  return null;
}

export function validateRequired(value, fieldName = 'Este campo') {
  if (!value || (typeof value === 'string' && !value.trim())) {
    return `${fieldName} es requerido`;
  }
  return null;
}
