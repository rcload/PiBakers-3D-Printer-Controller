_author_ = 'William'

import RPi.GPIO as GPIO
from time import sleep
# GPIO.setmode(GPIO.BCM)


class motor(object):

	def __init__(self, name, direction, step):
		self.ID = name  # identify is this Motor X, Y, Z, E?
		self.DIR = direction
		self.STEP = step
		self.pos = 0  #upon creation we assume the printhead is home

	def get_DIR(self):
		return self.DIR

	def get_STEP(self):
		return self.STEP

	def get_ID(self):
		return self.ID

	def move(self,param, myPosition):
		# we assume our incoming param is in mm for our printrbot prints
		import configVars as Vars		
	
		GPIO.setmode(GPIO.BCM)
				
		GPIO.setup(self.DIR, GPIO.OUT)
		GPIO.setup(self.STEP, GPIO.OUT)
				
		# Depending on last position of the head, our direction may change on the coord plane
		DIR = 1  # assuming clockwise
		param = param - myPosition
		print("About to Move", self.ID, param)
		
		if(param < 0.0):
			DIR = 0
			param = param*-1
				
		steps = 0.0
		traveled = 0.0

		end = param*80 # see documentation for logic in tranlating param to mm -- 1/16th step
		
		mmPerSecMove = Vars.feedrate/60
		# print("Current FeedRate ", Vars.feedrate)
		# print("Rate of mm per sec movement", mmPerSecMove)
		sleepTime = 1 / (80*16*mmPerSecMove)
		# sleepTime = 1 / (80*mmPerSecMove)
		#sleepTime = .0005
		# print("sleepTime: ", sleepTime)
		
		# print("Attempting to STEP and DIR ", self.STEP, self.DIR)
		# print("Starting", self.ID)
		try:
			while steps <= end:
				
				GPIO.output(self.DIR, DIR)	 # A4988 Stepper Driver DIR
				
				GPIO.output(self.STEP, 1)
				sleep(sleepTime) 			 # an artistic choice for now
				steps = steps + .5 		 # taking a half-step	
				# traveled = traveled + .31345	 # mm traveled per half-step
				
				GPIO.output(self.STEP, 0)
				sleep(sleepTime)
				steps = steps + .5
				# traveled = traveled + .31345
		 
		finally:
			# GPIO.cleanup()		 # clear pulses from pins
			
			#post-mortem of motor moves
			'''print("read in parameter[mm] of ", param)
			#print("Our step goal: ", end)
			#print("We Stepped ", steps)
			# print("Traveled [mm]: ", traveled)'''
			# print("Finished! ", self.ID, "steps moved: ", steps)

	
	def moveZ(self,param, myPosition):
		# we assume our incoming param is in mm for our printrbot prints
		import configVars as Vars		
	
		GPIO.setmode(GPIO.BCM)
				
		GPIO.setup(self.DIR, GPIO.OUT)
		GPIO.setup(self.STEP, GPIO.OUT)
				
		# Depending on last position of the head, our direction may change on the coord plane
		DIR = 1  # assuming clockwise

		param = param - myPosition
		print( "going to move this guy ", param)

		if(param < 0.0):
			DIR = 0
			param = param*-1
				
		steps = 0.0
		traveled = 0.0

		end = param*2560 # see documentation for logic in tranlating param to mm -- 1/16th step

		mmPerSecMove = Vars.feedrate/60
		# print("Current FeedRate ", Vars.feedrate)
		# print("Rate of mm per sec movement", mmPerSecMove)
		sleepTime = 1 / (80*16*mmPerSecMove)
		# print("sleepTime: ", sleepTime)
		
		# print("Attempting to STEP and DIR ", self.STEP, self.DIR)
		# print("Starting", self.ID)
		try:
			while steps <= end:
				
				GPIO.output(self.DIR, DIR)	 # A4988 Stepper Driver DIR
				
				GPIO.output(self.STEP, 1)
				sleep(sleepTime) 			 # an artistic choice for now
				steps = steps + .5 		 # taking a half-step	
				
				GPIO.output(self.STEP, 0)
				sleep(sleepTime)
				steps = steps + .5
				
		finally:
			# GPIO.cleanup()		 # clear pulses from pins
			
			#post-mortem of motor moves
			'''print("read in parameter[mm] of ", param)
			# print("Our step goal: ", end)
			# print("We Stepped ", steps)
			# print("Traveled [mm]: ", traveled)'''
			# print("Finished! ", self.ID, "steps moved: ", steps)

	
	def moveDeprecated(self,param, myPosition):
		# we assume our incoming param is in mm for our printrbot prints
		
		GPIO.setmode(GPIO.BCM)
				
		GPIO.setup(self.DIR, GPIO.OUT)
		GPIO.setup(self.STEP, GPIO.OUT)
				
		# Depending on last position of the head, our direction may change on the coord plane
		DIR = 1  # assuming clockwise
		param = param - myPosition

		if(param < 0.0):
			DIR = 0
			param = param*-1
				
		steps = 0.0
		traveled = 0.0
		end = param*5 # see documentation for logic in tranlating param to mm
		if self.ID == 'z':
			end = end*2
		# print("Attempting to STEP and DIR ", self.STEP, self.DIR)
		# print("Starting", self.ID)
		try:
			while steps <= end:
				
				GPIO.output(self.DIR, DIR)	 # A4988 Stepper Driver DIR
				
				GPIO.output(self.STEP, 1)
				sleep(0.005) 			 # an artistic choice for now
				steps = steps +.5 		 # taking a half-step	
				traveled = traveled + .31345	 # mm traveled per half-step
				
				GPIO.output(self.STEP, 0)
				sleep(0.005)
				steps = steps +.5
				traveled = traveled + .31345
		 
		finally:
			# GPIO.cleanup()		 # clear pulses from pins
			
			#post-mortem of motor moves
			'''print("read in parameter[mm] of ", param)
			print("Our step goal: ", end)
			print("We Stepped ", steps)
			print("Traveled [mm]: ", traveled)'''
			print("Finished! ", self.ID, "MM moved: ", traveled)

	def moveExtruder(self,param, myPos):
		# we assume our incoming param is in mm for our printrbot prints
		
		GPIO.setmode(GPIO.BCM)
				
		GPIO.setup(self.DIR, GPIO.OUT)
		GPIO.setup(self.STEP, GPIO.OUT)
				
		# Depending on last position of the head, our direction may change on the coord plane
		DIR = 1  # assuming clockwise
		
		param = param - myPos
			
		if(param < 0.0):
			DIR = 0
			param = param*-1
				
		steps = 0.0
		traveled = 0.0
		end = param*96 # see documentation for logic in tranlating param to mm
		
		# print("Attempting to STEP and DIR ", self.STEP, self.DIR)
		print("Starting", self.ID)
		try:
			while steps <= end:
				
				GPIO.output(self.DIR, DIR)	 # A4988 Stepper Driver DIR
				
				GPIO.output(self.STEP, 1)
				sleep(0.005) 			 # an artistic choice for now
				steps = steps+ .5 		 # taking a half-step	
				#traveled = traveled + .31345	 # mm traveled per half-step
				
				GPIO.output(self.STEP, 0)
				sleep(0.005)
				steps = steps + .5
				# traveled = traveled + .31345
		 
		finally:
			print "fin"
			# GPIO.cleanup()		 # clear pulses from pins
	
	def simpleMove(self, param, direc):

		# this function is build for simple incremental moves -- like zero-ing out to HOME	
		
		GPIO.setmode(GPIO.BCM)
				
		GPIO.setup(self.DIR, GPIO.OUT)
		GPIO.setup(self.STEP, GPIO.OUT)
				
		DIR = direc  # assuming counter-clockwise for the zero-out
	
		steps = 0.0
		traveled = 0.0
		end = param*5 # see documentation for logic in tranlating param to mm
		
		try:
			while steps <= end:
				
				GPIO.output(self.DIR, DIR)	 # A4988 Stepper Driver DIR
				
				GPIO.output(self.STEP, 1)
				sleep(0.005) 			 # an artistic choice for now
				steps = steps +.5 		 # taking a half-step	
				traveled = traveled + .31345	 # mm traveled per half-step
				
				GPIO.output(self.STEP, 0)
				sleep(0.005)
				steps = steps +.5
				traveled = traveled + .31345
		 
		finally:
			print "fin"
			# GPIO.cleanup()		 # clear pulses from pins

