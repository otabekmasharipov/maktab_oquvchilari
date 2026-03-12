/**
 * RezyumeBot - Telegram Bot
 * Node.js + Telegraf.js
 * 
 * Bot collects user data step by step and generates a WebApp URL
 */

// ===== CONFIGURATION =====
require('dotenv').config();

const { Telegraf, Scenes, Markup, WizardScene } = require('telegraf');

// Replace with your actual values
const BOT_TOKEN = process.env.BOT_TOKEN || '8367817177:AAEkkteQ7h-TUn3SCW47mDlQ1ptw8pt9_Mg';
const SITE_URL = process.env.SITE_URL || 'https://your-site.uz';

// ===== VALIDATION LIMITS =====
const LIMITS = {
  fullName: 50,
  grade: 20,
  school: 100,
  dream: 100
};

// ===== HELPER FUNCTIONS =====

/**
 * Validate and sanitize input
 */
function sanitizeInput(text, maxLength) {
  if (!text) return '';
  // Remove any potential malicious characters
  const sanitized = text.trim().replace(/[<>'";&]/g, '');
  return sanitized.substring(0, maxLength);
}

/**
 * Generate WebApp URL with encoded parameters
 */
function generateWebAppURL(data) {
  const params = new URLSearchParams();
  
  if (data.fullName) params.append('fullName', encodeURIComponent(data.fullName));
  if (data.grade) params.append('grade', encodeURIComponent(data.grade));
  if (data.school) params.append('school', encodeURIComponent(data.school));
  if (data.dream) params.append('dream', encodeURIComponent(data.dream));
  if (data.phone) params.append('phone', encodeURIComponent(data.phone));
  if (data.email) params.append('email', encodeURIComponent(data.email));
  if (data.bio) params.append('bio', encodeURIComponent(data.bio));
  
  const queryString = params.toString();
  return queryString ? `${SITE_URL}/index.html?${queryString}` : SITE_URL;
}

/**
 * Create main keyboard with WebApp button
 */
function createWebAppKeyboard(url) {
  return Markup.inlineKeyboard([
    [
      Markup.button.webApp(
        '📋 Rezyume Yaratish',
        url
      )
    ]
  ]);
}

// ===== WIZARD SCENE =====
const resumeWizard = new WizardScene(
  'resume-wizard',
  // Step 1: Full Name
  (ctx) => {
    ctx.reply(
      '👤 *Ism va Familiyangizni kiriting:*\n\nMasalan: Sardor Karimov',
      {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      }
    );
    return ctx.wizard.next();
  },
  // Step 2: Grade
  (ctx) => {
    const fullName = sanitizeInput(ctx.message?.text, LIMITS.fullName);
    
    if (!fullName || fullName.length < 2) {
      ctx.reply('❌ Iltimos, to\'g\'ri ism kiriting!');
      return;
    }
    
    ctx.session.fullName = fullName;
    
    ctx.reply(
      '🏫 *Sinfingizni kiriting:*\n\nMasalan: 10-A',
      {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      }
    );
    return ctx.wizard.next();
  },
  // Step 3: School
  (ctx) => {
    const grade = sanitizeInput(ctx.message?.text, LIMITS.grade);
    
    if (!grade) {
      ctx.reply('❌ Iltimos, sinf kiriting!');
      return;
    }
    
    ctx.session.grade = grade;
    
    ctx.reply(
      '🏫 *Maktabingiz nomini kiriting:*\n\nMasalan: 45-maktab, Toshkent',
      {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      }
    );
    return ctx.wizard.next();
  },
  // Step 4: Dream Profession
  (ctx) => {
    const school = sanitizeInput(ctx.message?.text, LIMITS.school);
    
    if (!school) {
      ctx.reply('❌ Iltimos, maktab nomini kiriting!');
      return;
    }
    
    ctx.session.school = school;
    
    ctx.reply(
      '💼 *Kasb orzuingizni kiriting:*\n\nMasalan: Dasturchi, Shifokor, Muhandis...',
      {
        parse_mode: 'Markdown',
        reply_markup: { remove_keyboard: true }
      }
    );
    return ctx.wizard.next();
  },
  // Step 5: Finish - Generate URL
  async (ctx) => {
    const dream = sanitizeInput(ctx.message?.text, LIMITS.dream);
    
    if (!dream) {
      ctx.reply('❌ Iltimos, kasb orzuingizni kiriting!');
      return;
    }
    
    ctx.session.dream = dream;
    
    // Generate WebApp URL
    const webAppURL = generateWebAppURL({
      fullName: ctx.session.fullName,
      grade: ctx.session.grade,
      school: ctx.session.school,
      dream: ctx.session.dream
    });
    
    // Send completion message with WebApp button
    await ctx.reply(
      `✅ *Ma'lumotlaringiz qabul qilindi!*\n\n` +
      `👤 Ism: ${ctx.session.fullName}\n` +
      `🏫 Sinf: ${ctx.session.grade}\n` +
      `🏫 Maktab: ${ctx.session.school}\n` +
      `💼 Kasb orzusi: ${ctx.session.dream}\n\n` +
      `Quyidagi tugma orqali rezyumangizni yarating:`,
      {
        parse_mode: 'Markdown',
        ...createWebAppKeyboard(webAppURL)
      }
    );
    
    // Send just the URL as well for copying
    await ctx.reply(
      `🔗 Havola (nusxalash uchun):\n\`${webAppURL}\``,
      {
        parse_mode: 'Markdown'
      }
    );
    
    return ctx.scene.leave();
  }
);

// ===== BOT SETUP =====
const bot = new Telegraf(BOT_TOKEN);

// Initialize session middleware
bot.use(Telegraf.session());

// Register wizard scene
bot.use(resumeWizard.middleware());

// ===== COMMAND HANDLERS =====

// /start command
bot.start(async (ctx) => {
  const welcomeMessage = `
🎉 *RezyumeBot ga xush kelibsiz!*

Maktab o'quvchilari uchun shaxsiy rezyume yarating.

📝 *Bot qanday ishlaydi:*
1. Ism va Familiyangizni kiritasiz
2. Sinfingizni ko'rsatdasiz
3. Maktab nomini yozasiz
4. Kasb orzuingizni kiritasiz
5. Rezyumangizni yaratasiz!

📋 Rezyumeni boshlash uchun quyidagi tugmani bosing yoki /resume buyrug'ini yuboring:
  `;
  
  await ctx.reply(welcomeMessage, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.callback('🚀 Rezyume Yaratish', 'start_wizard')]
    ])
  });
});

// /resume command - start wizard
bot.command('resume', (ctx) => {
  ctx.scene.enter('resume-wizard');
});

// Callback query handler for inline buttons
bot.action('start_wizard', (ctx) => {
  ctx.answerCallbackQuery();
  ctx.scene.enter('resume-wizard');
});

// /help command
bot.help((ctx) => {
  ctx.reply(
    `📚 *Yordam*\n\n` +
    `/start - Botni ishga tushirish\n` +
    `/resume - Yangi rezyume yaratish\n` +
    `/help - Bu yordamchi xabar\n\n` +
    `Bot Ismoil tomonidan yaratilgan © 2025`,
    { parse_mode: 'Markdown' }
  );
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot xatolik:', err);
  ctx.reply('❌ Xatolik yuz berdi. Iltimos, qayta urinib ko\'ring.');
});

// ===== START BOT =====
console.log('🤖 RezyumeBot ishga tushmoqda...');

try {
  bot.launch(() => {
    console.log('✅ Bot muvaffaqiyatli ishga tushdi!');
    console.log('📱 Telegramda botni topishingiz mumkin');
  });
} catch (error) {
  console.error('❌ Botni ishga tushirishda xatolik:', error.message);
  console.log('\nIltimos, BOT_TOKEN ni .env fayliga yozing yoki bot.js dagi BOT_TOKEN ni o\'zgartiring.');
}

// Graceful stop
process.once('SIGINT', () => {
  console.log('\n⏹️ Bot to\'xtatildi');
  bot.stop('SIGINT');
});

process.once('SIGTERM', () => {
  console.log('\n⏹️ Bot to\'xtatildi');
  bot.stop('SIGTERM');
});
