
def parseIntoThread(param):

	i = 0
	while i<len(param):
		if param[i] == 'X':
			print("Printing this to X ", param[i+1])
		if param[i] == 'Y':
			print("Printing this to Y ", param[i+1])
		if param[i] == 'Z':
			print("Printing this to Z ", param[i+1])
		if param[i] == 'E':
			print("Printing thos to E ", param[i+1])
		i = i + 1

def organizeParams(param):
	# The reorder gospel is [X,Y,Z,E,F]
	reorder = [None] * 5
	i = 0
	while i<len(param):
		if param[i] == 'X':
			print(" X: ", param[i+1])
			reorder[0] = param[i+1]
		if param[i] == 'Y':
			print(" Y: ", param[i+1])
			reorder[1] = param[i+1]
		if param[i] == 'Z':
			print(" Z: ", param[i+1])
			reorder[2] = param[i+1]
		if param[i] == 'E':
			print(" E: ", param[i+1])
			reorder[3] = param[i+1]
		if param[i] == 'F':
			print(" F: ", param[i+1])
			reorder[4] = param[i+1]
		i = i + 1

	return reorder

def zeroOut(param):
	i = 0
	while i<len(param):
		if param[i] is  None:
			param[i] = 0
		i = i+1
	return param

