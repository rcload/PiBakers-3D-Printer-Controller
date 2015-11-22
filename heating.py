#!/usr/bin/python
# -*- coding: utf-8 -*-

from __future__ import division
import RPi.GPIO as GPIO
import spidev
import time
import configVars as vars

#settemp = 200.0
mosfet = 25

GPIO.setmode(GPIO.BCM)
GPIO.setup(mosfet, GPIO.OUT)

temptable = [[23, 300.0],[25, 295.0],[27, 290.0],[28, 285.0],[31, 280.0],[33, 275.0],[35, 270.0],[38, 265.0],[41, 260.0],[44, 255.0],[48, 250.0],[52, 245.0],[56, 240.0],[61, 235.0],[66, 230.0],[71, 225.0],[78, 220.0],[84, 215.0],[92, 210.0],[100, 205.0],[109, 200.0],[120, 195.0],[131, 190.0],[143, 185.0],[156, 180.0],[171, 175.0],[187, 170.0],[205, 165.0],[224, 160.0],[245, 155.0],[268, 150.0],[293, 145.0],[320, 140.0],[348, 135.0],[379, 130.0],[411, 125.0],[445, 120.0],[480, 115.0],[516, 110.0],[553, 105.0],[591, 100.0],[628, 95.0],[665, 90.0],[702, 85.0],[737, 80.0],[770, 75.0],[801, 70.0],[830, 65.0],[857, 60.0],[881, 55.0],[903, 50.0],[922, 45.0],[939, 40.0],[954, 35.0],[966, 30.0],[977, 25.0],[985, 20.0],[993, 15.0],[999, 10.0],[1004,5.0],[1008,0.0]]
fulltable = []

for i in range(0,temptable[0][0]):
    fulltable.append([i,temptable[0][1]])

fulltable.append(temptable[0])

lastdiff = 0

for i in range(1,len(temptable)):
    prev = temptable[i-1][1]
    diff = (temptable[i-1][1] - temptable[i][1])/(temptable[i][0] - temptable[i-1][0])
    for j in range(temptable[i-1][0]+1,temptable[i][0]):
        prev = prev - diff
        
        fulltable.append([j,prev])
    fulltable.append(temptable[i])
    lastdiff = diff
    
prev = temptable[len(temptable)-1][1]
for i in range(temptable[len(temptable)-1][0]+1, 1024):
    prev = prev - diff
    fulltable.append([i,prev])


def bitstring(n):
    s = bin(n)[2:]
    return '0'*(8-len(s)) + s

def read(adc_channel=0, spi_channel=0):
    conn = spidev.SpiDev(0, spi_channel)
    conn.max_speed_hz = 1200000 # 1.2 MHz
    cmd = 128
    if adc_channel:
        cmd += 32
    reply_bytes = conn.xfer2([cmd, 0])
    reply_bitstring = ''.join(bitstring(n) for n in reply_bytes)
    reply = reply_bitstring[5:15]
    value = int(reply, 2) / 2**10 * 1023
    tempc = fulltable[1023 - int(value)][1]
    
    tempf = tempc * 1.8 + 32 #C to F
	
    print ("%4d/1023 => %4.1f °C => %4.1f °F from adc " % (value, tempc, tempf))
    return tempc
	
def run():
    try:
        while True:
            time.sleep(2)
            vars.curTemp = read()
            if vars.curTemp < vars.targetTemp:
	        GPIO.output(mosfet, GPIO.HIGH)
                print "Heating"
            else:
                GPIO.output(mosfet, GPIO.LOW)
                print "Not heating"
    except KeyboardInterrupt: 
        print "Keyboard interruption"
    except:
        print "Some other exception occurred"
    finally:
        GPIO.cleanup()
