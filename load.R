library(tidyverse)
library(lubridate)
library(janitor)
library(pdftools)

source("lib/price.R")

trips <- read_tsv("data/source/trips.tsv") %>%
  clean_names %>%
  select(-creation_date, -cancel, -user:-my_receipts)  %>%
  filter(status != "Cancelled") %>%
  mutate_at(
    .vars = vars(start_of_reservation, end_of_reservation),
    .funs = dmy_hm
  ) %>%
  mutate(start_date = as_date(start_of_reservation)) %>%
  mutate(trip_cost = str_remove_all(trip_cost, fixed("$"))) %>%
  mutate(trip_cost = str_replace_all(trip_cost, fixed(","), fixed("."))) %>%
  mutate(trip_cost = as.numeric(trip_cost)) %>%
  mutate(on_peak = wday(start_of_reservation, week_start = 1) > 5) %>%
  mutate(duration = time_length(start_of_reservation %--% end_of_reservation, "hours")) %>%
  mutate(estimates_actual_duration = pmap(list(hrs = duration, kms = kilometres, on_peak = on_peak), .f = estimate_rate))

invoices <- tibble(invoice = fs::dir_ls("data/source/invoices/", glob = "*.pdf")) %>%
  extract(
    invoice,
    into = c("year", "month"),
    regex = "CommunautoOntario_([0-9]{4})-([0-9]{2})\\.pdf",
    remove = FALSE
  ) %>%
  mutate(text = map(invoice, pdf_text)) %>%
  mutate(text = str_split(text, "\\n")) %>%
  unnest(c(text))
  
invoice_trips <- invoices %>% 
  filter(str_detect(text, "^[0-9]{4} ")) %>%
  separate(text, into = c(
    "vehicle",
    "user",
    "start_date",
    "start_time",
    "end_date",
    "end_time",
    "days",
    "hours",
    "cost_time",
    "km",
    "cost_km",
    "booking_fee",
    "fees_credits",
    "text"
  ), sep = " +", extra = "merge") %>%
  separate(text, into = c(
    "description",
    "text"
  ), sep = "\\$", extra = "merge") %>%
  separate(text, into = c(
    "subtotal",
    "rate",
    "credit_purchases"
  ), sep = " +") %>%
  mutate(
    across(
      c(
        hours,
        cost_time,
        cost_km,
        booking_fee,
        fees_credits,
        subtotal,
        credit_purchases
      ),
      ~ as.double(str_remove_all(.x, "[^0-9.]"))
    ),
    days = as.integer(days),
    start_date = as_date(paste0(year, "/", start_date)),
    end_date = as_date(paste0(year, "/", end_date))
  ) %>%
  mutate(
    total_with_tax = (subtotal * 1.13) - credit_purchases
  )

invoice_trips <- pdf_text("data/source/invoices/CommunautoOntario_2022-09.pdf") %>%
  as_tibble() %>%
  mutate(year = 2022, month = 09) %>% # TODO: infer from PDF, when we pull multiple at once
  rename(text = value) %>%
  mutate(text = str_split(text, "\\n")) %>%
  unnest(c(text)) %>%
  filter(str_detect(text, "^[0-9]{4} ")) %>%
  separate(text, into = c(
    "vehicle",
    "user",
    "start_date",
    "start_time",
    "end_date",
    "end_time",
    "days",
    "hours",
    "cost_time",
    "km",
    "cost_km",
    "booking_fee",
    "fees_credits",
    "text"
  ), sep = " +", extra = "merge") %>%
  separate(text, into = c(
    "description",
    "text"
  ), sep = "\\$", extra = "merge") %>%
  separate(text, into = c(
    "subtotal",
    "rate",
    "credit_purchases"
  ), sep = " +") %>%
  mutate(
    across(
      c(
        hours,
        cost_time,
        cost_km,
        booking_fee,
        fees_credits,
        subtotal,
        credit_purchases
      ),
      ~ as.double(str_remove_all(.x, "[^0-9.]"))
    ),
    days = as.integer(days),
    start_date = as_date(paste0(year, "/", start_date)),
    end_date = as_date(paste0(year, "/", end_date))
  ) %>%
  mutate(
    total_with_tax = (subtotal * 1.13) - credit_purchases
  )

pdf_text("data/source/invoices/CommunautoOntario_2022-09.pdf") %>%
  as_tibble() %>%
  mutate(year = 2022, month = 09) %>% # TODO: infer from PDF, when we pull multiple at once
  rename(text = value) %>%
  mutate(text = str_split(text, "\\n")) %>%
  unnest(c(text)) %>%
  mutate(section = case_when(
    str_detect(text, "^Total Cost Of Trips") ~ "fees",
    str_detect(text, "^Sub total") ~ "payments"
  )) %>%
  fill(section, .direction = "down") %>%
  filter(str_detect(text, "^ ?[0-9]{6} ")) %>%
  mutate(text = str_trim(text)) %>%
  separate(text, into = c(
    "user",
    "date",
    "text"
  ), sep = " +", extra = "merge") %>%
  separate(text, into = c(
    "description",
    "total"
  ), sep = "\\$", extra = "merge") %>%
  mutate(
    description = str_squish(description),
    total = as.double(total),
    total = case_when(
      section == "fees" ~ total * -1,
      section == "payment" ~ total,
      TRUE ~ total
    ),
    date = as_date(parse_date_time(
      date,
      orders = c(
        "%b-%y",
        "%d/%m/%Y"
      )
    ))
  )


# trips are taxed
# BUT credit portion of trips are not
# fees are taxed (even when it's a refund from a past month)
# BUT Deposit, DPF are not


