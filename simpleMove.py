

def simpleMove(self, param, direc): # this function is build for simple incremental moves -- like zero-ing out to HOME	
	GPIO.setmode(GPIO.BCM)
	GPIO.setup(self.DIR, GPIO.OUT)
	GPIO.setup(self.STEP, GPIO.OUT)		

	GPIO.setup(13, GPIO.IN, pull_up_down = GPIO.PUD_DOWN)

	DIR = direc  # assuming counter-clockwise for the zero-out
	steps = 0.0
	traveled = 0.0
	end = param * 80 # see documentation for logic in tranlating param to mm
	try:	
		while steps <= end:		
			GPIO.output(self.DIR, DIR)	 # A4988 Stepper Driver DIR
			
			GPIO.output(self.STEP, 1)
			sleep(0.0005) 			 # an artistic choice for now
			steps = steps +.5 		 # taking a half-step	
		
			GPIO.output(self.STEP, 0)
			sleep(0.0005)
			steps = steps +.5
	
	 
		finally:
			pass
			# GPIO.cleanup()		 # clear pulses from pins''' 
