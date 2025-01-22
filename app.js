var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
const moment = require('moment-timezone');
var admin = require('./firebase/firebase-config');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/', indexRouter);
app.use('/users', usersRouter);

// catch 404 and forward to error handler
app.use(function (req, res, next) {
  next(createError(404));
});

// error handler
app.use(function (err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

// Function to run at midnight and update Firebase Realtime Database
function runAtMidnight() {
  const malaysiaTime = moment.tz('Asia/Kuala_Lumpur');  // Get current time in Malaysia
  const currentDate = malaysiaTime.format('DD-MM-YYYY');  // Format date as YYYY-MM-DD

  const db = admin.database();
  const ref = db.ref('/Dashboard');

  // Update /Dashboard/lastUpdate with the current date
  ref.child('lastUpdate').set(currentDate, (error) => {
    if (error) {
      console.error('Failed to update lastUpdate:', error);
    } else {
      console.log('Successfully updated lastUpdate with current date:', currentDate);
    }
  });

  // Update /Dashboard/DailyMovement with Room A and Room B set to 0
  ref.child('DailyMovement').update({
    'Room A': 0,
    'Room B': 0
  }, (error) => {
    if (error) {
      console.error('Failed to update DailyMovement:', error);
    } else {
      console.log('Successfully reset DailyMovement values for Room A and Room B');
    }
  });

  // Update /Dashboard/WeeklyMovement with the last 7 days' values
  const weeklyMovementRef = ref.child('WeeklyMovement');
  weeklyMovementRef.once('value', (snapshot) => {
    const data = snapshot.val() || {};
    const currentDateKey = currentDate;  // Key as the current date

    // Remove the oldest entry if there are already 7 entries
    if (Object.keys(data).length >= 7) {
      const oldestDateKey = Object.keys(data)
        .sort((a, b) => {
          // Convert date strings into date objects
          const dateA = a.split('-').reverse().join('-'); // Convert dd-mm-yyyy -> yyyy-mm-dd
          const dateB = b.split('-').reverse().join('-'); // Convert dd-mm-yyyy -> yyyy-mm-dd

          // Compare the date objects
          return new Date(dateA) - new Date(dateB); // Sort chronologically
        })[0]; 
      weeklyMovementRef.child(oldestDateKey).remove();
      console.log(`Removed oldest date (${oldestDateKey}) from WeeklyMovement`);
    }

    // Add the current date with value 0
    weeklyMovementRef.child(currentDateKey).set(0, (error) => {
      if (error) {
        console.error('Failed to update WeeklyMovement:', error);
      } else {
        console.log('Successfully updated WeeklyMovement with current date:', currentDateKey);
      }
    });
  });
}

function getTimeUntilMidnight() {
  const malaysiaTime = moment.tz('Asia/Kuala_Lumpur');  // Get current time in Malaysia
  // Get the 12:00 AM of the next day

  const midnight = malaysiaTime.clone().endOf('day');  // Get the 12:00 AM of the next day
  // Calculate the difference between now and midnight in milliseconds
  const diff = midnight.diff(malaysiaTime);

  // Tetsing with 2am

  // const twoAM = malaysiaTime.clone().hour(2).minute(27).second(0).millisecond(0);  // Set time to 2:00 AM
  // // If it's already past 2:00 AM today, set it to 2:00 AM the next day
  // if (malaysiaTime.isAfter(twoAM)) {
  //   twoAM.add(1, 'days');  // Move to the next day
  // }
  // // Calculate the difference between now and 2:00 AM in milliseconds
  // const diff = twoAM.diff(malaysiaTime);

  return diff;
}


function scheduleMidnightJob() {
  const timeUntilMidnight = getTimeUntilMidnight();

  // Schedule the function to run at 12:00 AM Malaysia time
  setTimeout(() => {
    runAtMidnight();  // Run the function once at midnight
    scheduleMidnightJob();  // Reschedule the job to run the next day
  }, timeUntilMidnight);
}

// Start the job when the server starts
scheduleMidnightJob();

module.exports = app;
app.listen(3048, () => {
  console.log('port running atport number : 3048')
})
