__author__ = 'William'

class PrintHead:
    # x = 0
    # y = 0
    # z = 0

	def __init__(self):
        	self.x = 0.0
        	self.y = 0.0
        	self.z = 0.0
		self.e = 0.0

	def get_x(self):
        	return self.x

	def get_y(self):
        	return self.y

	def update(self, x, y, z):
        	self.x = x
        	self.y = y
        	self.z = z
	
	def updateX(self, x):
		self.x = x

	def updateY(self, y):
		self.y = y
	
	def updateZ(self, z):
		self.z = z

	def updateE(self, e):
		self.e = e
