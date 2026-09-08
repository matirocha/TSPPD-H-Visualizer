import gurobipy as gp
from gurobipy import GRB
import os

# Import solve_instance or re-solve to inspect model directly
import notebooks.tsppd_h_gurobi as mod

# Let's inspect the solved variables
sol = mod.solve_instance(5, 1, 0.1)

print("Tour:", sol["tour"])
for s, step in enumerate(sol["steps"]):
    print(f"\n--- STEP {s}: {step['from']} -> {step['to']} ---")
    print(f"deliverA: {step['deliverA']}, pickupB: {step['pickupB']}")
    print(f"handlingCount: {step['handlingCount']}, handlingCost: {step['handlingCost']}")
    print(f"kMax: {step['kMax']}")
    print(f"rehandledB: {step['rehandledB']}")
    print(f"rehandledA: {step['rehandledA']}")
    print(f"deliveredSlots: {step['deliveredSlots']}")
    print(f"newBSlots: {step['newBSlots']}")
