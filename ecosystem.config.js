module.exports = {
apps: [
{
name: "firstfemale-backend",
script: "dist/main.js",
instances: 1,
exec_mode: "fork",
env: {
DATABASE_URL: "mysql://firstfemale_user:Indu1975%40123@localhost:3306/firstfemale",
JWT_SECRET: "FirstLadySecretKey",
JWT_EXPIRES_IN: "7d",
NODE_ENV: "production",

SMS_TOKEN_KEY: "32335072616d6f647369723130301671881556",
SMS_SENDERID: "AVMIND",
SMS_TEMPLATEID: "1207175329297573217",
SMS_ROUTE: "06",

RAZORPAY_KEY_ID: "rzp_live_KWmChFZ5o9oWHY",
RAZORPAY_KEY_SECRET: "JGqJT3N6jM7mDzC1R7ucyvWy",

},
},
],
};

