# Machine API Contract

The app only enables dispensing after the same-origin machine controller reports that it is connected and ready. The controller must expose these endpoints:

- `GET /api/status` returns JSON such as `{"connected":true}` only while the dispenser is safe and ready.
- `POST /api/dispense` accepts JSON such as `{"grams":250,"seedType":"Mixed seed"}` and returns `{"accepted":true}` only after validating and queuing the request.

The controller is responsible for enforcing its supported gram limits, preventing overlapping jobs, and applying its hardware safety checks. The browser asks the operator to confirm each dispense request. The current Arduino source is empty, so this contract still needs to be implemented for the actual board and dispenser hardware.