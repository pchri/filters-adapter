# CountdownTimerAdapter
Adapter for Mozilla IoT Gateway implementing various timers as (virtual) devices

Version 0.0.0 implements a simple countdown timer filter device.

## What?
Basically each device has an input and an output and works like this:

```
input:  00001110001000111000000000000000000000000000
output: 00001111111111111111111111111111111000000000
                         <------time------>
```

So the output is active for some time after the input was active.

## Configuration
Obviously CountdownTimer devices cannot be discovered by scanning for new devices. They need to be added/configured manually from the Addons list. The configuration is very simple:

![CountdownTimerDevice configuration example](https://github.com/pchri/countdown-timer-adapter/blob/master/images/configuration-example.png)

## Rules
To use the device you add two Rules.

One for the input, connecting some switch or sensor to the input property of the filter.

One for the output, connecting the output property of the filter to some light or your toaster.