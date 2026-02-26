---
id: TASK-136
title: Product registry for Boat Management
status: To Do
assignee: []
created_date: '2026-02-26 09:49'
updated_date: '2026-02-26 10:39'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Create product registry for Boat Managemen that can be extended: e.g. engines_registry: contains a list of typical sailboat engine models and variants, winches_registry: contains typical winches. This could be single table, where categories are dedfined by the existing equipment structure in boat-management. 

Registry should provide: name specs of the equipment, link to manufacturer, link(s) to get spare parts, etc information, link(s) to product documentation

Target is not create comprenhensive product database at first at least, but provide quick access to most typical equipments: engines, gearboxes, masts and booms, chartplotters, radars, ais, gos, batteries, chargers, solar, winches, furlers, wind generators, inverters, instruments, anchors, vhf-radios, dinghies, outboards... then when registry size grows as user base and equipment base grows, the product data could be an asset that would be possiblt utilize further. So important functionality both from user experience and from business point of view.

Concept is that users could find quickly a matching (autocomplete search) equipment for their boat, and if not found search a specific one that and  product would be added to product registry for others to use. Product registry could be initially seeded with small subset of the products.

check idea for data in /boat-management/config/engines.json. Note that database should perhaps be equipment class agnostic, and handle product metadata in agnostic way, rather than for exmple
<!-- SECTION:DESCRIPTION:END -->
