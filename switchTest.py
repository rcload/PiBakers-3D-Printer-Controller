import RPi.GPIO as GPIO
from time import sleep
GPIO.setmode(GPIO.BCM)
GPIO.setup(13, GPIO.IN, pull_up_down=GPIO.PUD_DOWN)

try:
	while True:
		if GPIO.input(13)== 0:
			print "SWITCH ON!"
		sleep(0.5)
finally:
	GPIO.cleanup

