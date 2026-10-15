-- WirePlumber 0.4 rule for the PC, installed by ~/scripts/bootstrap. Its onboard
-- card stays on the pro-audio profile, the only one offering the analog
-- (headphones) and digital (speakers) outputs at once, so the dock can stream
-- to both and the panel's output switcher always lists both. Pro-audio names
-- them "Built-in Audio Pro" and "Built-in Audio Pro 1"; these say what they are.
table.insert(alsa_monitor.rules, {
  matches = { { { "node.name", "equals", "alsa_output.pci-0000_00_1f.3.pro-output-0" } } },
  apply_properties = { ["node.description"] = "Headphones" },
})

table.insert(alsa_monitor.rules, {
  matches = { { { "node.name", "equals", "alsa_output.pci-0000_00_1f.3.pro-output-1" } } },
  apply_properties = { ["node.description"] = "Speakers" },
})
