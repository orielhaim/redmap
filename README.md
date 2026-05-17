# Radar

**Israeli emergency alert analytics dashboard**

## About

Radar is an open-source analytics dashboard built on top of the [Siren](https://siren.co.il) alert infrastructure. It takes real-time and historical alert data from the Siren API and presents it in a clean, visual, and easy-to-explore interface.

The project includes an overview dashboard with statistics and charts, an interactive map showing alert locations and events.

This project also serves as a reference implementation for working with the Siren API - feel free to learn from it, fork it, and build whatever you want on top of it.

## Roadmap

- [ ] **Alert gap detection** - identify "holes" in alerts where a preliminary warning was issued for a city but no actual siren followed
- [ ] **Prediction system integration** - connect to the Siren prediction engine for AI-based alert forecasting and pattern analysis

## Powered by Siren

This project is built on top of [Siren](https://siren.co.il) - an open, nonprofit alert infrastructure that provides real-time and historical emergency alert data for Israel. All alert data displayed in Radar is sourced from the Siren API.

## License

[Apache License 2.0](LICENSE)
