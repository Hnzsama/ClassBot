def mystery(x):
    return [i**2 for i in x if i % 2 == 0]
data = [1, 2, 3, 4, 5]
result = mystery(data)
print(result)