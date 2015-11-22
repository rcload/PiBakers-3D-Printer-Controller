__author__ = 'William'

import RPi.GPIO as GPIO
from time import sleep
GPIO.setmode(GPIO.BCM)

from printHead import PrintHead

milimeterMode = True

dummySTEP = 20
dummyDIR = 21

xSTEP = 17
xDIR = 27

ySTEP = 22 
yDIR = 5

zSTEP = 6 
zDIR = 13

eSTEP =19 
eDIR = 26

xStopper = 18 
yStopper = 23
zStopper = 24

filamentDiameter = 0.0

feedrate = 0.0

targetTemp = 0
curTemp = 0

fanRate = 0.0


