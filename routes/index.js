const router = require('express').Router();
const Sentry = require("@sentry/node");
const SupabaseController = require('../controllers/supabaseController.js');
require("../libs/instrument.js");

router.get('/register', SupabaseController.renderRegisterPage);
router.post('/register', SupabaseController.createData);
router.get('/success', (req, res) => {
    res.render('success', { message: "Verified!" });
});
router.get('/activate/:token', SupabaseController.activateAccount);
router.get('/login', SupabaseController.renderLoginPage);
router.post('/login', SupabaseController.login);
router.get('/forget-password', SupabaseController.renderForgetPasswordPage);
router.post('/forget-password', SupabaseController.forgetPassword);
router.get('/reset-password/:token', SupabaseController.renderResetPasswordPage);
router.post('/reset-password/:token', SupabaseController.resetPassword);
router.get('/konfirmasi-email', (req, res) => {
    res.render('success', { message: "Email sent!" });
})
router.get('/profile', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('profile', { name: req.session.user.name });
    // res.render('profile', { name: user.name });
});
module.exports = router;
