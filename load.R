library(tidyverse)
library(lubridate)
library(janitor)

trips <- read_tsv("data/source/trips.tsv") %>%
  clean_names %>%
  select(-creation_date, -cancel, -user:-my_receipts)  %>%
  filter(status != "Cancelled") %>%
  mutate_at(
    .vars = vars(start_of_reservation, end_of_reservation),
    .funs = dmy_hm
  ) %>%
  mutate(trip_cost = str_remove_all(trip_cost, fixed("$"))) %>%
  mutate(trip_cost = str_replace_all(trip_cost, fixed(","), fixed("."))) %>%
  mutate(trip_cost = as.numeric(trip_cost))

trips %>%
  mutate(length = time_length(start_of_reservation %--% end_of_reservation, "hours"))
